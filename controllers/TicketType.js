const TicketType = require("../models/TicketType");

exports.createTicketType = async (req, res) => {
    try {
      const ticket = await TicketType.create({
        ...req.body,
        createdBy: req.user._id  // Attach the user ID of the creator
      });
  
      res.status(201).json({
        message: "Ticket Type created successfully",
      });
    } catch (err) {
      res.status(500).json({
        message: "An error occurred while creating the ticket type",
        error: err.message
      });
    }
  };
