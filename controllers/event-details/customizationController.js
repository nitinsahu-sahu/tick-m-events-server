const Event = require('../../models/event-details/Event');
const Customization = require('../../models/event-details/Customization');
const cloudinary = require('cloudinary').v2;
const ErrorResponse = require('../../utils/errorHandler');

// Create Customization
exports.createEventCustomization = async (req, res, next) => {
  try {
    const { frame, themeColor, customColor } = req.body
    const { eventLogo } = req.files
    const { eventId, ticketCustomId } = req.params
    const result = await cloudinary.uploader.upload(eventLogo.tempFilePath, {
      folder: 'event_logos',
      width: 500,
      crop: "scale"
    });

    await Event.findByIdAndUpdate(
      { _id: eventId },
      { step: 3 },
      { new: true }
    );

    // Create the event first
    const eventCustomization = await Customization.create({
      frame,
      eventId,
      ticketCustomId,
      themeColor,
      customColor,
      eventLogo: {
        public_id: result.public_id,
        url: result.secure_url
      }
    });

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventCustomizationId: eventCustomization._id
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get Customization by Event ID
exports.getCustomization = async (req, res, next) => {
  try {
    const customization = await Customization.findOne({ eventId: req.params.eventId });

    if (!customization) {
      return next(new ErrorResponse(`Customization not found for event ${req.params.eventId}`, 404));
    }

    res.status(200).json({
      success: true,
      data: customization
    });
  } catch (err) {
    next(err);
  }
};

// Update Customization
exports.updateCustomization = async (req, res, next) => {
  try {
    let customization = await Customization.findOne({ eventId: req.params.eventId });

    if (!customization) {
      return next(new ErrorResponse(`Customization not found for event ${req.params.eventId}`, 404));
    }

    // If logo is being updated
    if (req.file) {
      // First delete previous logo
      await cloudinary.uploader.destroy(customization.logo.public_id);

      // Upload new logo
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'event_logos',
        width: 500,
        crop: "scale"
      });

      req.body.logo = {
        public_id: result.public_id,
        url: result.secure_url
      };
    }

    customization = await Customization.findOneAndUpdate(
      { eventId: req.params.eventId },
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: customization
    });
  } catch (err) {
    next(err);
  }
};

// Delete Customization
exports.deleteCustomization = async (req, res, next) => {
  try {
    const customization = await Customization.findOne({ eventId: req.params.eventId });

    if (!customization) {
      return next(new ErrorResponse(`Customization not found for event ${req.params.eventId}`, 404));
    }

    // Delete logo from cloudinary
    await cloudinary.uploader.destroy(customization.logo.public_id);

    await customization.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};