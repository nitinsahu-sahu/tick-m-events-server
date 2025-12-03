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
const CustomPhotoFrame = require('../../models/event-details/CustomPhotoFrame');
const TicketConfiguration = require('../../models/event-details/Ticket');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const Cancellation = require('../../models/event-details/event-cancelled')
const eventRating = require('../../models/event-details/event-rating')
const mongoose = require('mongoose');
const eventPromo = require('../../models/marketing-engagement/promotion-&-offer.schema')

// Create Event
exports.createEvent = async (req, res, next) => {
  // Start a mongoose session for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventName, date, time, category, eventType, location, format, description,
      name, number, email, website, whatsapp, linkedin, facebook, tiktok } = req.body;

    const { coverImage, portraitImage } = req.files || {};

    // Check if file was uploaded
    if (!coverImage) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Please upload a cover image"
      });
    }

    // Validate file size and type
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (coverImage.size > MAX_FILE_SIZE) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cover image is too large (max 5MB)"
      });
    }

    if (!ALLOWED_TYPES.includes(coverImage.mimetype)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG, and WebP images are allowed"
      });
    }

    // Upload image to Cloudinary with error handling
    let result;
    try {
      result = await cloudinary.uploader.upload(coverImage.tempFilePath, {
        folder: 'event_cover_images',
        width: 1000,
        crop: "scale"
      });
    } catch (uploadError) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: "Failed to upload cover image",
        error: uploadError.message
      });
    }

    // Upload portraitImage with error handling
    let portraitImageData = {};
    if (portraitImage) {
      if (portraitImage.size > MAX_FILE_SIZE) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Portrait image is too large (max 5MB)"
        });
      }

      if (!ALLOWED_TYPES.includes(portraitImage.mimetype)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Only JPEG, PNG, and WebP images are allowed for portrait"
        });
      }

      try {
        const portraitResult = await cloudinary.uploader.upload(portraitImage.tempFilePath, {
          folder: 'event_portrait_images',
          width: 500,
          height: 500,
          crop: "fill"
        });

        portraitImageData = {
          public_id: portraitResult.public_id,
          url: portraitResult.secure_url
        };
      } catch (portraitError) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          success: false,
          message: "Failed to upload portrait image",
          error: portraitError.message
        });
      }
    }

    // Create the event within the transaction
    let event;
    try {
      event = await Event.create([{
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
        createdBy: req.user._id,
        portraitImage: portraitImageData,
        step: 1
      }], { session });

      event = event[0]; // Because we used create with array
    } catch (eventError) {
      // Clean up uploaded images if event creation fails
      await cloudinary.uploader.destroy(result.public_id);
      if (portraitImageData.public_id) {
        await cloudinary.uploader.destroy(portraitImageData.public_id);
      }

      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: "Failed to create event",
        error: eventError.message
      });
    }

    // Create organizer within the same transaction
    try {
      await Organizer.create([{
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
        eventId: event._id
      }], { session });
    } catch (organizerError) {
      // Clean up everything if organizer creation fails
      await cloudinary.uploader.destroy(result.public_id);
      if (portraitImageData.public_id) {
        await cloudinary.uploader.destroy(portraitImageData.public_id);
      }
      await Event.deleteOne({ _id: event._id }).session(session);

      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: "Failed to create organizer",
        error: organizerError.message
      });
    }

    // If everything succeeds, commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventId: event._id
    });

  } catch (error) {
    // This catches any unexpected errors
    await session.abortTransaction();
    session.endSession();

    console.error("Error creating event:", error);

    // Check if it's a mongoose validation error
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    // Check for duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate field value entered",
        field: Object.keys(error.keyPattern)[0]
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
      step: 4,
      $or: [
        {
          date: { $gt: currentDateTime.toISOString().split('T')[0] }
        },
        {
          date: currentDateTime.toISOString().split('T')[0],
          time: {
            $gt: currentDateTime.toLocaleTimeString('en-US',
              { hour12: false }
            )
          }
        }
      ]
    })
      .sort({ date: 1, startTime: 1 })
      .limit(10)
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
      const [
        organizer, customization, tickets, eventOrder, visibility, review, ticketConfig,
        photoFrame, refundRequests, promotion] = await Promise.all([
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
          Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
          eventReview.find({ eventId: event._id, status: "approved" }).select('-updatedAt -isDelete -__v').lean(),
          TicketConfiguration.findOne({ eventId: event._id }).lean(),
          CustomPhotoFrame.findOne({ eventId: event._id }).select('-__v').lean(),
          RefundRequest.find({ eventId: event._id })
            .populate({ path: 'userId', select: 'name email' })
            .populate({ path: 'orderId', select: 'paymentStatus tickets' })
            .lean(),
          eventPromo.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),

        ]);

      const enrichedOrders = eventOrder.map(orderItem => {
        const matchingRefund = refundRequests.find(refund => {
          const refundOrderId = refund.orderId?._id || refund.orderId;
          return refundOrderId?.toString() === orderItem._id.toString();
        });

        return {
          ...orderItem,
          refundAmount: matchingRefund?.refundAmount || 0,
          refundStatus: matchingRefund?.refundStatus || null
        };
      });

      return {
        ...event,
        order: enrichedOrders,
        refundRequests,
        organizer,
        customization,
        tickets,
        review,
        visibility,
        refundPolicy: ticketConfig?.refundPolicy || null,
        isRefundPolicyEnabled: ticketConfig?.isRefundPolicyEnabled || false,
        payStatus: ticketConfig?.payStatus || 'paid',
        purchaseDeadlineDate: ticketConfig?.purchaseDeadlineDate || null,
        photoFrame,
        promotion
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
    const identifier = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    // Build query based on identifier type
    const query = isObjectId
      ? { _id: identifier }
      : { urlSlug: identifier };

    Object.assign(query, {
      isDelete: { $ne: true },
      step: 4,
    });

    const event = await Event.findOne(query)
      .select('-createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found or deleted."
      });
    }
    const eventId = event._id
    // Fetch all related data in parallel
    const [organizer, customization, tickets, visibility, review, rating] = await Promise.all([
      Organizer.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Customization.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Ticket.find({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      Visibility.findOne({ eventId }).select('-createdAt -updatedAt -isDelete -__v').lean(),
      eventReview.find({ eventId, status: "approved" }).select('-updatedAt -isDelete -__v').lean(),
      eventRating.find({ eventId }).select('-updatedAt -isDelete -__v').lean()
    ]);

    // Combine all data
    const eventWithDetails = {
      ...event,
      organizer: organizer || null,
      customization: customization || null,
      tickets: tickets || [],
      visibility: visibility || null,
      review: review || [],
      rating
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

exports.getUncompletedEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .select('-createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found or deleted."
      });
    }

    res.status(200).json({
      success: true,
      message: "Uncompleted event fetched successfully.",
      event
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
      res.status(404).json({
        success: false,
        error: `Event not found.`
      });
    }

    // Check if user is event owner
    if (event.createdBy.toString() !== req.user.id) {
      res.status(401).json({
        success: false,
        error: `User ${req.user.id} is not authorized to delete this event`
      });
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
    const cover = req.files?.cover;

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    let category = await Category.findOne({ name });
    let action = "";

    if (!category) {
      if (!cover) {
        return res.status(400).json({
          success: false,
          message: "Please upload a category image"
        });
      }

      const result = await cloudinary.uploader.upload(cover.tempFilePath, {
        folder: 'event_category',
        width: 400,
        crop: "scale"
      });

      category = new Category({
        name,
        cover: {
          public_id: result.public_id,
          url: result.secure_url
        },
        subcategories: subcategories || []
      });

      action = "created";

    } else {
      // Check if new subcategories were added
      let updated = false;

      for (const incomingSub of subcategories || []) {
        const exists = category.subcategories.some(sub => sub.name === incomingSub.name);
        if (!exists) {
          category.subcategories.push(incomingSub);
          updated = true;
        }
      }

      action = updated ? "updated" : "exists";
    }

    await category.save();

    let message = {
      created: "Category created successfully",
      updated: "Category updated successfully",
      exists: "Category already exists and no changes were made"
    };

    res.status(201).json({
      message: message[action],
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
    const categories = await Category.find({ type: "page" });

    // Create an array to hold categories with their events
    const categoriesWithEvents = [];
    const currentDateTime = new Date();

    // For each category, find matching events
    for (const category of categories) {
      // Get all category names to search for (parent + subcategories)
      const categoryNames = getAllCategoryIds(category);
      // Find events that match any of these category names
      const events = await Event.find({
        category: { $in: categoryNames },
        status: 'approved',
        eventType: 'Public',
        step: 4,
        isDelete: false,
        $or: [
          {
            date: { $gt: currentDateTime.toISOString().split('T')[0] }
          },
          {
            date: currentDateTime.toISOString().split('T')[0],
            time: {
              $gt: currentDateTime.toLocaleTimeString('en-US',
                { hour12: false }
              )
            }
          }
        ]
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
    const identifier = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    // Build query based on identifier type
    const query = isObjectId
      ? { _id: identifier }
      : { urlSlug: identifier };

    Object.assign(query);

    const category = await Category.findOne(query);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get all category names to search for (parent + subcategories)
    const categoryNames = getAllCategoryIds(category);

    // Find events that match any of these category names
    const currentDateTime = new Date();

    // Get all events that aren't deleted and are in the future
    const events = await Event.find({
      category: { $in: categoryNames },
      isDelete: { $ne: true },
      step: 4,
      status: "approved",
      eventType: 'Public',
      $or: [
        {
          date: { $gt: currentDateTime.toISOString().split('T')[0] }
        },
        {
          date: currentDateTime.toISOString().split('T')[0],
          time: {
            $gt: currentDateTime.toLocaleTimeString('en-US',
              { hour12: false }
            )
          }
        }
      ]
    })
      .sort({ date: 1, startTime: 1 })
      .limit(10)
      .select('-createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    // Get all related data for each event
    const eventsWithDetails = await Promise.all(events.map(async (event) => {
      const [customization, visibility, review, ticketConfig, promotion] = await Promise.all([
        Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
        eventReview.find({ eventId: event._id, status: "approved" }).select('-updatedAt -isDelete -__v').lean(),
        TicketConfiguration.findOne({ eventId: event._id }).lean(),
        eventPromo.find({ eventId: event._id, status: "active" }).select('-updatedAt -__v').lean(),
      ]);

      return {
        ...event,
        customization,
        review,
        promotion,
        visibility,
        purchaseDeadlineDate: ticketConfig?.purchaseDeadlineDate || null,
      };
    }));

    res.status(200).json({
      success: true,
      category: {
        ...category.toObject(),
        events: eventsWithDetails
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
    const { themeColor, customColor, frame } = req.body;
    const { eventLogo, coverImage, portraitImage } = req.files || {};

    const eventData = await Event.findById(id);
    if (!eventData) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    let customizationData = await Customization.findOne({ eventId: id });

    if (!customizationData) {
      if (!eventLogo) {
        return res.status(400).json({
          success: false,
          message: "eventLogo is required to create new customization.",
        });
      }

      const ticketConfig = await TicketConfiguration.findOne({ eventId: id }).lean();

      if (!ticketConfig) {
        return res.status(400).json({
          success: false,
          message: "Ticket configuration not found for this event.",
        });
      }

      const result = await cloudinary.uploader.upload(eventLogo.tempFilePath, {
        folder: 'event_logos',
        width: 500,
        crop: "scale",
      });

      customizationData = new Customization({
        eventId: id,
        ticketCustomId: ticketConfig._id.toString(), // ✅ Use existing ticket config ID
        themeColor,
        customColor,
        frame,
        eventLogo: {
          public_id: result.public_id,
          url: result.secure_url,
        }
      });
    }
    else {
      // 🛠 Update existing fields
      if (themeColor) customizationData.themeColor = themeColor;
      if (customColor) customizationData.customColor = customColor;
      if (frame) customizationData.frame = frame;

      if (eventLogo) {
        if (customizationData.eventLogo?.public_id) {
          await cloudinary.uploader.destroy(customizationData.eventLogo.public_id);
        }

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
    }

    // ✅ Upload cover image (for event model)
    if (coverImage) {
      if (eventData.coverImage?.public_id) {
        await cloudinary.uploader.destroy(eventData.coverImage.public_id);
      }

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

    // ✅ Upload portrait image (for event model)
    if (portraitImage) {
      if (eventData.portraitImage?.public_id) {
        await cloudinary.uploader.destroy(eventData.portraitImage.public_id);
      }

      const result = await cloudinary.uploader.upload(portraitImage.tempFilePath, {
        folder: 'event_portrait_images',
        width: 800, // adjust as needed
        crop: "scale",
      });

      eventData.portraitImage = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    await customizationData.save();
    await eventData.save();

    res.status(200).json({
      success: true,
      message: customizationData.isNew ? "Customization created successfully" : "Changes applied successfully",
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
      step: 4,
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

exports.getAllServiceCategories = async (req, res) => {
  try {
    // First fetch all categories with their subcategories
    const categories = await Category.find({ type: "serviceCategory" });

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

exports.validateViewUpdate = async (req, res) => {
  try {
    const { validationOptions } = req.body;
    const { id: eventId } = req.params;
    // Validate the input
    if (!validationOptions ||
      !['scan', 'list', 'both'].includes(validationOptions.selectedView)) {
      return res.status(400).json({ message: 'Invalid validation options' });
    }

    // If list view is selected but no methods are chosen
    if (validationOptions.selectedView === 'list' &&
      (!Array.isArray(validationOptions.listViewMethods) ||
        validationOptions.listViewMethods.length === 0)) {
      return res.status(400).json({ message: 'Please select at least one list view method' });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { validationOptions },
      { new: true, runValidators: true }
    );

    if (!updatedEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json({
      message: 'Validation options updated successfully',
      validationOptions: updatedEvent.validationOptions,
    });
  } catch (error) {
    console.error('Error updating validation options:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getEventPageCustomization = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }


    // Check if event exists
    const eventData = await Event.findById(id);
    if (!eventData) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Find customization for this event
    const customizationData = await Customization.findOne({ eventId: id });

    if (!customizationData) {
      return res.status(200).json({
        success: true,
        message: "No customization found for this event",
        customization: null,
      });
    }

    // Also send coverImage from Event if you want (some are in eventData)
    const coverImage = eventData.coverImage || null;
    const portraitImage = eventData.portraitImage || null;
    return res.status(200).json({
      success: true,
      customization: {
        themeColor: customizationData.themeColor,
        customColor: customizationData.customColor,
        frame: customizationData.frame,
        eventLogo: customizationData.eventLogo,
        coverImage: coverImage,
        portraitImage: portraitImage
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateEventStatus = async (req, res) => {
  try {
    const { eventId, status } = req.params;
    const { reason } = req.body;
    const userId = req.user._id
    // Validate status
    if (!['pending', 'approved', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // If cancelling, require a reason
    if (status === 'cancelled' && !reason) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    // Update status
    event.status = status;
    await event.save();

    // If cancelled, save cancellation record
    if (status === 'cancelled') {
      await Cancellation.create({
        eventId: event._id,
        cancelledBy: userId,
        reason: reason
      });
    }

    res.status(200).json({
      success: true,
      message: `Event status updated to ${status}`,
    });

  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};