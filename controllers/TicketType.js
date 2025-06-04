const TicketType = require("../models/TicketType");

exports.fetchTicketType = async (req, res) => {
  try {
    // Assuming user ID is available in req.user._id (common with JWT/auth middleware)
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const ticketTypes = await TicketType.find({ createdBy: userId })
      .sort({ createdAt: -1 }); // Optional: sort by newest first

    res.status(200).json({
      success: true,
      count: ticketTypes.length,
      data: ticketTypes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.createTicketType = async (req, res) => {
  const { name, quantity, ticketDescription, price, validity, optionList } = req.body
  const options = JSON.parse(optionList)
  try {
    await TicketType.create({
      name,
      quantity,
      ticketDescription,
      price,
      validity,
      options,
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

exports.updateTicketType = async (req, res) => {
  console.log(req.body, req.params, req.user._id);

  try {
    const { id } = req.params;
    const { quantity, price, ticketDescription } = req.body;
    const userId = req.user._id; // Assuming user ID is available in req.user

    // Validate the input fields
    if (!quantity && !price && !ticketDescription) {
      return res.status(400).json({
        success: false,
        message: "At least one field (quantity, price, or ticketDescription) must be provided for update",
      });
    }

    // Find the ticket type by ID
    const ticketType = await TicketType.findById(id);

    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket type not found",
      });
    }

    // Check if the current user is the creator of the ticket
    if (ticketType.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only update tickets you created",
      });
    }

    // Prepare the update object with only allowed fields
    const updateFields = {};
    if (quantity !== undefined) {
      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: "Minimum quantity should be 1",
        });
      }
      updateFields.quantity = quantity;
    }
    if (price !== undefined) updateFields.price = price;
    if (ticketDescription !== undefined) updateFields.ticketDescription = ticketDescription;

    // Update the ticket type
    await TicketType.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Applied",
    });
  } catch (error) {
    console.error("Error updating ticket type:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};