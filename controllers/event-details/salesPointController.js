const SalesPoint = require('../../models/event-details/SalesPoint');
const ErrorResponse = require('../../utils/errorHandler');


// Create Sales Points
exports.createSalesPoints = async (req, res, next) => {
  try {
    // Add eventId to req.body
    req.body.eventId = req.params.eventId;
    
    const salesPoints = await SalesPoint.create(req.body);

    res.status(201).json({
      success: true,
      data: salesPoints
    });
  } catch (err) {
    next(err);
  }
};

// Get Sales Points by Event ID
exports.getSalesPoints = async (req, res, next) => {
  try {
    const salesPoints = await SalesPoint.findOne({ eventId: req.params.eventId });

    if (!salesPoints) {
      return next(new ErrorResponse(`Sales points not found for event ${req.params.eventId}`, 404));
    }

    res.status(200).json({
      success: true,
      data: salesPoints
    });
  } catch (err) {
    next(err);
  }
};

// Update Sales Points
exports.updateSalesPoints = async (req, res, next) => {
  try {
    let salesPoints = await SalesPoint.findOne({ eventId: req.params.eventId });

    if (!salesPoints) {
      return next(new ErrorResponse(`Sales points not found for event ${req.params.eventId}`, 404));
    }

    salesPoints = await SalesPoint.findOneAndUpdate(
      { eventId: req.params.eventId }, 
      req.body, 
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: salesPoints
    });
  } catch (err) {
    next(err);
  }
};

// Delete Sales Points
exports.deleteSalesPoints = async (req, res, next) => {
  try {
    const salesPoints = await SalesPoint.findOne({ eventId: req.params.eventId });

    if (!salesPoints) {
      return next(new ErrorResponse(`Sales points not found for event ${req.params.eventId}`, 404));
    }

    await salesPoints.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};