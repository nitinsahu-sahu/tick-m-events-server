const Event = require('../../models/event-details/Event');
const ErrorResponse = require('../../utils/errorHandler');
const cloudinary = require('cloudinary').v2;
const Organizer = require('../../models/event-details/Organizer');

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
        const events = await Event.find().populate('createdBy', 'name email');
        res.status(200).json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (err) {
        next(err);
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
        let event = await Event.findById(req.params.id);

        if (!event) {
            return next(new ErrorResponse(`Event not found with id of ${req.params.id}`, 404));
        }

        // Check if user is event owner
        if (event.createdBy.toString() !== req.user.id) {
            return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this event`, 401));
        }

        // If image is being updated
        if (req.file) {
            // First delete previous image
            await cloudinary.uploader.destroy(event.coverImage.public_id);

            // Upload new image
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'event_cover_images',
                width: 1500,
                crop: "scale"
            });

            req.body.coverImage = {
                public_id: result.public_id,
                url: result.secure_url
            };
        }

        event = await Event.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: event
        });
    } catch (err) {
        next(err);
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