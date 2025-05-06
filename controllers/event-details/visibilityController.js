const Visibility = require('../../models/event-details/Visibility');
const ErrorResponse = require('../../utils/errorHandler');


// Create Visibility Options
exports.createPublicationVisibility = async (req, res, next) => {

  try {
    const { autoShareOnSocialMedia, status, customUrl, publicEvent, privateEvent, homepageHighlighting } = req.body
    const { eventId, ticketCustomId, eventCustomizationId } = req.params

    await Visibility.create({
      eventId,
      ticketCustomId,
      eventCustomizationId,
      status,
      customUrl,
      promotionAndHighlight: {
        homepageHighlighting,
        autoShareOnSocialMedia
      },
      visibilitySettings: {
        publicEvent,
        privateEvent
      }
    });

    res.status(201).json({
      success: true,
      message: status === "draft" ? 'Event created as a draft successfully' : 'Event created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get Visibility by Event ID
exports.getVisibility = async (req, res, next) => {
  try {
    const visibility = await Visibility.findOne({ eventId: req.params.eventId });

    if (!visibility) {
      return next(new ErrorResponse(`Visibility options not found for event ${req.params.eventId}`, 404));
    }

    res.status(200).json({
      success: true,
      data: visibility
    });
  } catch (err) {
    next(err);
  }
};

// Update Visibility
exports.updateVisibility = async (req, res, next) => {
  try {
    let visibility = await Visibility.findOne({ eventId: req.params.eventId });

    if (!visibility) {
      return next(new ErrorResponse(`Visibility options not found for event ${req.params.eventId}`, 404));
    }

    visibility = await Visibility.findOneAndUpdate(
      { eventId: req.params.eventId },
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: visibility
    });
  } catch (err) {
    next(err);
  }
};

// Delete Visibility
exports.deleteVisibility = async (req, res, next) => {
  try {
    const visibility = await Visibility.findOne({ eventId: req.params.eventId });

    if (!visibility) {
      return next(new ErrorResponse(`Visibility options not found for event ${req.params.eventId}`, 404));
    }

    await visibility.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};