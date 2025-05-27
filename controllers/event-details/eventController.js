const ErrorResponse = require('../../utils/errorHandler');
const cloudinary = require('cloudinary').v2;
const Event = require('../../models/event-details/Event');
const Category = require('../../models/event-details/Category');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Ticket = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const eventReview = require('../../models/event-details/eventReview');
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
        // Get all events that aren't deleted
        const events = await Event.find({ isDelete: { $ne: true } })
            .select('-createdBy -createdAt -updatedAt -isDelete -__v')
            .lean(); // Convert to plain JavaScript objects

        // Create array for basic details
        const basicDetails = events.map(event => ({
            _id: event._id,
            eventName: event.eventName,
            date: event.date,
            time: event.time
        }));

        // Get all related data for each event
        const eventsWithDetails = await Promise.all(events.map(async (event) => {
            const [organizer, customization, tickets, visibility] = await Promise.all([
                Organizer.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean()
            ]);

            return {
                ...event,
                organizer,
                customization,
                tickets,
                visibility
            };
        }));

        res.status(200).json({
            success: true,
            message: "Event fetch successfully.",
            fullData: eventsWithDetails, // Full data with all related information
            basicDetails: basicDetails   // Separate simplified object
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
            eventReview.find({ eventId,status: "approved" }).select('-updatedAt -isDelete -__v').lean()
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
        const { isDelete, eventName, date, time, category, eventType, coverImage, location, format, description } = req.body;
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
                coverImage,
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
            message: isDelete ? "Event deleted successfully" : "Event reschedule successfully"
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
 
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
 
    let category = await Category.findOne({ name });
 
    if (!category) {
      // Category doesn't exist: create it directly
      category = new Category({ name, subcategories: subcategories || [] });
    } else {
      // Category exists: check for subcategory and nested subcategory duplicates
      for (const incomingSub of subcategories || []) {
        let existingSub = category.subcategories.find(sub => sub.name === incomingSub.name);
 
        if (!existingSub) {
          // Subcategory doesn't exist: push it entirely
          category.subcategories.push(incomingSub);
        } else if (incomingSub.subcategories && incomingSub.subcategories.length > 0) {
          // Subcategory exists: check for nested sub-subcategories
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
 
    res.status(201).json({ message: 'Category saved/updated successfully', category });
  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};
 
// Get all categories with subcategories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve categories', error });
  }
};

exports.getChildCategory = async (req, res) => {
  try {
    const { parentId } = req.params;
 
    const parent = await Category.findById(parentId);
 
    if (!parent) {
      return res.status(404).json({ message: 'Parent category not found' });
    }
 
    res.status(200).json(parent.subcategories);
  } catch (error) {
    console.error('Error fetching child categories:', error);
    res.status(500).json({ message: 'Failed to fetch child categories' });
  }
};