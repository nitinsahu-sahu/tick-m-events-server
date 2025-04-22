const Visibility = require('../../models/event-details/Visibility');
const ErrorResponse = require('../../utils/errorHandler');


// Create Visibility Options
exports.createVisibility = async (req, res, next) => {
  try {
    // Add eventId to req.body
    req.body.eventId = req.params.eventId;
    
    const visibility = await Visibility.create(req.body);

    res.status(201).json({
      success: true,
      data: visibility
    });
  } catch (err) {
    next(err);
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