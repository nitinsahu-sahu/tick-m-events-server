const ErrorResponse = require('../../utils/errorHandler');
const cloudinary = require('cloudinary').v2;
const Event = require('../../models/event-details/Event');
const Category = require('../../models/event-details/Category');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Ticket = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const eventReview = require('../../models/event-details/eventReview');
const EventOrders = require('../../models/event-order/EventOrder');
const moment = require('moment');

// Create Event
exports.createEvent = async (req, res, next) => {
  try {
    const { eventName, date, time, category, eventType, location, format, description,
      name, number, email, website, whatsapp, linkedin, facebook, tiktok } = req.body;
    const { coverImage } = req.files;

    // Check if file was uploaded
    if (!coverImage) {
      return res.status(400).json({
        success: false,
        message: "Please upload a cover image"
      });
    }

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(coverImage.tempFilePath, {
      folder: 'event_cover_images',
      width: 1500,
      crop: "scale"
    });

    // Create the event first
    const event = await Event.create({
      eventName,
      date,
      time,
      category,
      eventType,
      coverImage: {
        public_id: result.public_id,
        url: result.secure_url
      },
      location,
      format,
      description,
      createdBy: req.user._id

    });

    // Then create the organizer with the event ID
    await Organizer.create({
      name,
      number,
      email,
      website,
      socialMedia: {
        "whatsapp": whatsapp,
        "linkedin": linkedin,
        "facebook": facebook,
        "tiktok": tiktok
      },
      eventId: event._id  // Use the created event's ID
    });

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventId: event._id
    });

  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get all events
exports.getEvents = async (req, res, next) => {
  try {
    const currentDateTime = new Date();

    // Get all events that aren't deleted and are in the future
    const events = await Event.find({
      isDelete: { $ne: true },
      $expr: {
        $gt: [
          {
            $dateFromString: {
              dateString: {
                $concat: [
                  "$date",
                  "T",
                  "$time",
                  ":00.000Z"
                ]
              }
            }
          },
          currentDateTime
        ]
      }
    })
      .select('-createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    // Create array for basic details
    const basicDetails = events.map(event => ({
      _id: event._id,
      eventName: event.eventName,
      date: event.date,
      time: event.time
    }));

    // Get all related data for each event
    const eventsWithDetails = await Promise.all(events.map(async (event) => {
      const [organizer, customization, tickets, order, review, visibility] = await Promise.all([
        Organizer.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        EventOrders.find({ eventId: event._id })
          .select('-qrCode -orderAddress -updatedAt -__v')
          .populate({
            path: 'userId',
            select: 'name email', // Only get the name field from User
            model: 'User' // Replace with your actual User model name
          })
          .lean(),
        eventReview.find({ eventId: event._id, status: "approved" }).select('-updatedAt -isDelete -__v').lean(),
        Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean()
      ]);

      return {
        ...event,
        order,
        organizer,
        customization,
        tickets,
        review,
        visibility
      };
    }));

    res.status(200).json({
      success: true,
      message: "Events fetched successfully.",
      fullData: eventsWithDetails,
      basicDetails: basicDetails
    });
  } catch (error) {
    console.error('Error fetching events:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
// Get single event

exports.getEvent = async (req, res, next) => {
  try {
    const eventId = req.params.id; // Extract event ID from URL params

    // Get the event (if not deleted)
    const event = await Event.findOne({
      _id: eventId,
      isDelete: { $ne: true }
    }).select('-createdBy -createdAt -updatedAt -isDelete -__v').lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found or deleted."
      });
    }

    // Fetch all related data in parallel
    const [organizer, customization, tickets, visibility, review] = await Promise.all([
      Organizer.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Customization.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Ticket.find({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Visibility.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      eventReview.find({ eventId, status: "approved" }).select('-updatedAt -isDelete -__v').lean()
    ]);

    // Combine all data
    const eventWithDetails = {
      ...event,
      organizer: organizer || null,
      customization: customization || null,
      tickets: tickets || [],
      visibility: visibility || null,
      review: review || []
    };

    res.status(200).json({
      success: true,
      message: "Event fetched successfully.",
      eventWithDetails
    });

  } catch (error) {
    console.error('Error fetching event:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Update event
exports.updateEvent = async (req, res, next) => {
  try {
    const { isDelete, eventName, date, time, category, eventType, location, format, description } = req.body;
    // Convert date if provided
    dateOnly = moment(date).format('YYYY-MM-DD');

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      {
        eventName,
        date: dateOnly,
        time,
        category,
        eventType,
        location,
        format,
        description,
        isDelete
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedEvent) {
      return res.status(404).json({
        status: 'fail',
        message: 'No event found with that ID'
      });
    }

    res.status(200).json({
      status: true,
      message: isDelete ? "Event deleted successfully" : date || time ? "Event reschedule successfully" : "Event update successfully"
    });
  } catch (err) {
    res.status(400).json({
      status: false,
      message: err.message
    });
  }
};

// Delete event
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new ErrorResponse(`Event not found with id of ${req.params.id}`, 404));
    }

    // Check if user is event owner
    if (event.createdBy.toString() !== req.user.id) {
      return next(new ErrorResponse(`User ${req.user.id} is not authorized to delete this event`, 401));
    }

    // Delete image from cloudinary
    await cloudinary.uploader.destroy(event.coverImage.public_id);

    await event.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

//Event category creation

exports.addCategory = async (req, res) => {
  try {
    const { name, subcategories } = req.body;
    const { cover } = req.files;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    let category = await Category.findOne({ name });

    if (!category) {
      // If no existing category, cover image is required
      if (!cover) {
        return res.status(400).json({
          success: false,
          message: "Please upload a category image"
        });
      }

      // Upload cover image
      const result = await cloudinary.uploader.upload(cover.tempFilePath, {
        folder: 'event_category',
        width: 400,
        crop: "scale"
      });

      // Create new category
      category = new Category({
        name,
        cover: {
          public_id: result.public_id,
          url: result.secure_url
        },
        subcategories: subcategories || []
      });

    } else {
      // If category exists, update subcategories only (do not touch cover)
      for (const incomingSub of subcategories || []) {
        let existingSub = category.subcategories.find(sub => sub.name === incomingSub.name);

        if (!existingSub) {
          // Subcategory doesn't exist: push it
          category.subcategories.push(incomingSub);
        } else if (incomingSub.subcategories && incomingSub.subcategories.length > 0) {
          // Nested sub-subcategories merge
          const existingSubSubNames = existingSub.subcategories?.map(sc => sc.name) || [];

          const newNestedSubs = incomingSub.subcategories.filter(
            subSub => !existingSubSubNames.includes(subSub.name)
          );

          if (!existingSub.subcategories) {
            existingSub.subcategories = [];
          }

          existingSub.subcategories.push(...newNestedSubs);
        }
      }
    }

    await category.save();

    res.status(201).json({
      message: 'Category saved/updated successfully',
      category
    });

  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    // First fetch all categories with their subcategories
    const categories = await Category.find({});

    // Create an array to hold categories with their events
    const categoriesWithEvents = [];

    // For each category, find matching events
    for (const category of categories) {
      // Get all category names to search for (parent + subcategories)
      const categoryNames = getAllCategoryIds(category);
      // Find events that match any of these category names
      const events = await Event.find({
        category: { $in: categoryNames },
        isDelete: false // assuming you don't want deleted events
      });

      // Add category with its events to the result array
      categoriesWithEvents.push({
        ...category.toObject(),
        events
      });
    }

    res.status(200).json({
      success: true,
      categories: categoriesWithEvents,
      message: "Category fetch successfully",

    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Helper function to get all category names (parent + subcategories)
// Helper function to get all category IDs (parent + subcategories)
function getAllCategoryIds(category) {
  const ids = [category._id.toString()]; // Convert ObjectId to string

  // Recursively get all subcategory IDs
  function getSubcategoryIds(subcategories) {
    for (const subcategory of subcategories) {
      ids.push(subcategory._id.toString());
      if (subcategory.subcategories && subcategory.subcategories.length > 0) {
        getSubcategoryIds(subcategory.subcategories);
      }
    }
  }

  if (category.subcategories && category.subcategories.length > 0) {
    getSubcategoryIds(category.subcategories);
  }

  return ids;
}

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get all category names to search for (parent + subcategories)
    const categoryNames = getAllCategoryIds(category);

    // Find events that match any of these category names
    const events = await Event.find({
      category: { $in: categoryNames },
      isDelete: false
    }).select('-__v'); // Exclude version key

    res.status(200).json({
      success: true,
      category: {
        ...category.toObject(),
        events
      }
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subcategories } = req.body;
    const { cover } = req.files || {};

    let category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Update name if provided
    if (name) category.name = name;

    // Update cover image if uploaded
    if (cover) {
      // Delete old image if it exists
      if (category.cover?.public_id) {
        await cloudinary.uploader.destroy(category.cover.public_id);
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(cover.tempFilePath, {
        folder: "event_category",
        width: 400,
        crop: "scale",
      });

      category.cover = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // Update subcategories (same logic as addCategory)
    if (subcategories) {
      for (const incomingSub of subcategories) {
        let existingSub = category.subcategories.find(
          (sub) => sub.name === incomingSub.name
        );

        if (!existingSub) {
          category.subcategories.push(incomingSub);
        } else if (incomingSub.subcategories?.length > 0) {
          const existingSubSubNames = existingSub.subcategories?.map((sc) => sc.name) || [];
          const newNestedSubs = incomingSub.subcategories.filter(
            (subSub) => !existingSubSubNames.includes(subSub.name)
          );
          existingSub.subcategories.push(...newNestedSubs);
        }
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(category.cover.public_id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateEventPageCostomization = async (req, res) => {
  try {
    const { id } = req.params;
    const { themeColor, customColor } = req.body;
    const { eventLogo, coverImage } = req.files || {};

    let eventData = await Event.findById(id);
    let customizationData = await Customization.findOne({ eventId: id });

    if (!eventData) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }
    if (!customizationData) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }
    // Update name if provided
    if (themeColor) customizationData.themeColor = themeColor;
    if (customColor) customizationData.customColor = customColor;

    // // Update cover image if uploaded
    if (eventLogo) {
      // Delete old image if it exists
      if (customizationData.eventLogo?.public_id) {
        await cloudinary.uploader.destroy(customizationData.eventLogo.public_id);
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(eventLogo.tempFilePath, {
        folder: 'event_logos',
        width: 500,
        crop: "scale",
      });

      customizationData.eventLogo = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }
    if (coverImage) {
      // Delete old image if it exists
      if (eventData.coverImage?.public_id) {
        await cloudinary.uploader.destroy(eventData.coverImage.public_id);
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(coverImage.tempFilePath, {
        folder: 'event_cover_images',
        width: 1500,
        crop: "scale",
      });

      eventData.coverImage = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    await customizationData.save();
    await eventData.save();

    res.status(200).json({
      success: true,
      message: "Changes applied successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getTodayEvents = async (req, res, next) => {
  try {
    const currentDate = new Date();
    // Set to start of day (00:00:00)
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    // Set to end of day (23:59:59)
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all events that aren't deleted and are today
    const events = await Event.find({
      isDelete: { $ne: true },
      $expr: {
        $and: [
          {
            $gte: [
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      "$date",
                      "T",
                      "$time",
                      ":00.000Z"
                    ]
                  }
                }
              },
              startOfDay
            ]
          },
          {
            $lte: [
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      "$date",
                      "T",
                      "$time",
                      ":00.000Z"
                    ]
                  }
                }
              },
              endOfDay
            ]
          }
        ]
      }
    })
      .select('-category -location -format -eventType -coverImage -description -reviewCount -soldTicket -ticketQuantity -createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    if (events.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No events found for today.",
        currentEvents: []
      });
    }

    // Get all related data for each event
    const eventsWithDetails = await Promise.all(events.map(async (event) => {
      const [order] = await Promise.all([
        // Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        EventOrders.find({ eventId: event._id, userId: req.user._id })
          .select(' -orderAddress -updatedAt -__v').lean(),
      ]);

      return {
        ...event,
        order,
      };
    }));

    res.status(200).json({
      success: true,
      message: "Today's events fetched successfully.",
      currentEvents: eventsWithDetails,
    });
  } catch (error) {
    console.error('Error fetching events:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
