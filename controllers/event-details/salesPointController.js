const SalesPoint = require('../../models/event-details/SalesPoint');


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
      res.status(404).json({
        success: false,
        error: `Sales points not found for event ${req.params.eventId}`
      });
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
       res.status(404).json({
        success: false,
        error: `Sales points not found for event ${req.params.eventId}`
      });
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
       res.status(404).json({
        success: false,
        error: `Sales points not found for event ${req.params.eventId}`
      });
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