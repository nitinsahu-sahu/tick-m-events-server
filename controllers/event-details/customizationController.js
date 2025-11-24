const Event = require('../../models/event-details/Event');
const Customization = require('../../models/event-details/Customization');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');


// Create Customization
exports.createEventCustomization = async (req, res, next) => {
  console.log('Creating event customization...');
  
  try {
    const { frame, themeColor, customColor } = req.body;
    const { eventId, ticketCustomId } = req.params;

    // Validation: Check if required fields are present
    if (!eventId || !ticketCustomId) {
      return res.status(400).json({
        success: false,
        message: "Event ID and Ticket Configuration ID are required"
      });
    }

    // Validation: Check if eventId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Event ID format"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(ticketCustomId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Ticket Configuration ID format"
      });
    }

    // Validation: Check if frame value is valid
    const validFrames = ['circle', 'square', 'rounded', 'triangle'];
    if (frame && !validFrames.includes(frame)) {
      return res.status(400).json({
        success: false,
        message: `Invalid frame type. Must be one of: ${validFrames.join(', ')}`
      });
    }

    // Validation: Check if eventLogo file exists
    if (!req.files || !req.files.eventLogo) {
      return res.status(400).json({
        success: false,
        message: "Event logo is required"
      });
    }

    const { eventLogo } = req.files;

    // Validation: Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(eventLogo.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG, PNG, JPG, and WEBP are allowed"
      });
    }

    // Validation: Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (eventLogo.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB"
      });
    }

    // Check if event exists
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    // Check if customization already exists for this event
    const existingCustomization = await Customization.findOne({ eventId });
    if (existingCustomization) {
      return res.status(409).json({
        success: false,
        message: "Customization already exists for this event"
      });
    }

    console.log('Uploading to Cloudinary...');
    
    // Upload to Cloudinary with error handling
    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinary.uploader.upload(eventLogo.tempFilePath, {
        folder: 'event_logos',
        width: 500,
        crop: "scale",
        quality: "auto",
        fetch_format: "auto"
      });
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to cloud storage",
        error: uploadError.message
      });
    }

    console.log('Updating event step...');
    
    // Update event step with error handling
    try {
      await Event.findByIdAndUpdate(
        { _id: eventId },
        { step: 3 },
        { new: true, runValidators: true }
      );
    } catch (updateError) {
      console.error('Event update error:', updateError);
      // Don't return here, we can still try to create the customization
    }

    console.log('Creating customization...');
    
    // Create the customization
    const eventCustomization = await Customization.create({
      frame,
      eventId,
      ticketCustomId,
      themeColor,
      customColor,
      eventLogo: {
        public_id: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url
      }
    });

    console.log('Customization created successfully');

    res.status(201).json({
      success: true,
      message: "Event customization created successfully",
      eventCustomizationId: eventCustomization._id,
      data: eventCustomization
    });

  } catch (error) {
    console.error('Error in createEventCustomization:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Customization already exists for this event"
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Server error while creating event customization",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get Customization by Event ID
exports.getCustomization = async (req, res, next) => {
  try {
    const customization = await Customization.findOne({ eventId: req.params.eventId });

    if (!customization) {
      res.status(404).json({
        success: false,
        error: `Customization not found for event ${req.params.eventId}`
      });
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
      res.status(404).json({
        success: false,
        error: `Customization not found for event ${req.params.eventId}`
      });
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
       res.status(404).json({
        success: false,
        error: `Customization not found for event ${req.params.eventId}`
      });
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