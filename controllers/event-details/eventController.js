const Event = require('../../models/event-details/Event');
const ErrorResponse = require('../../utils/errorHandler');
const cloudinary = require('cloudinary').v2;
const Organizer = require('../../models/event-details/Organizer');
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

// This api get only specific detail 

exports.getAllEventBasicDetails = async (req, res) => {
    try {
        const events = await Event.find({}, 'eventName date time'); // only select these fields

        res.status(200).json({
            success: true,
            message: 'Event list fetched successfully',
            data: events,
        });
    } catch (error) {
        console.error('Error fetching events:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


// Get all events
exports.getEvents = async (req, res, next) => {
    try {
        const events = await Event.find().populate('createdBy', 'name email');
        // Create a separate array with only specific fields
        const basicDetails = events.map(event => ({
            _id: event._id,
            eventName: event.eventName,
            date: event.date,
            time: event.time
        }));

        res.status(200).json({
            success: true,
            message: "Event fetch successfully.",
            fullData: events,        // Full data with populated fields
            basicDetails: basicDetails // Separate simplified object
        });
    } catch (error) {
        console.error('Error fetching events:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Get single event
exports.getEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id).populate('createdBy', 'name email');

        if (!event) {
            return next(new ErrorResponse(`Event not found with id of ${req.params.id}`, 404));
        }

        res.status(200).json({
            success: true,
            data: event
        });
    } catch (err) {
        next(err);
    }
};

// Update event
exports.updateEvent = async (req, res, next) => {
    try {
        const { eventName, date, time, category, eventType, coverImage, location, format, description } = req.body;

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
                description
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
            message: "Event reschedule successfully"
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