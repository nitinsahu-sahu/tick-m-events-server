const TicketType = require("../models/TicketType");
const TicketConfiguration = require('../models/event-details/Ticket');
const EventOrders = require('../models/event-order/EventOrder');

exports.fetchTicketType = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required"
      });
    }

    const ticketTypes = await TicketType.find({ createdBy: userId, eventId })
      .sort({ createdAt: -1 });

    // Get all orders for this event
    const orders = await EventOrders.find({ eventId, paymentStatus: "confirmed" })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 });

    const last12Months = getLast12Months();
    
    // Calculate revenue data
    const revenueGeneratedGraph = calculateMonthlyRevenue(orders, last12Months);
    const ticketWiseRevenue = calculateTicketWiseRevenue(orders, last12Months);
    
    res.status(200).json({
      success: true,
      count: ticketTypes.length,
      data: ticketTypes,
      revenueData: {
        monthlyRevenue: revenueGeneratedGraph,
        ticketWiseRevenue: ticketWiseRevenue
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Helper function to get last 12 months in 'YYYY-MM' format
const getLast12Months = () => {
  const months = [];
  const date = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const tempDate = new Date();
    tempDate.setMonth(tempDate.getMonth() - i);
    const year = tempDate.getFullYear();
    const month = String(tempDate.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }
  return months;
};

// Calculate monthly revenue
const calculateMonthlyRevenue = (orders, last12Months) => {
  const monthlyData = {};

  // Initialize all months with 0
  last12Months.forEach(month => {
    monthlyData[month] = 0;
  });

  // Sum revenue from confirmed payments per month
  orders.forEach(order => {
    if (order.paymentStatus === 'confirmed') {
      const orderMonth = order.createdAt.toISOString().slice(0, 7); // Gets 'YYYY-MM'
      if (monthlyData.hasOwnProperty(orderMonth)) {
        monthlyData[orderMonth] += order.totalAmount;
      }
    }
  });

  // Convert to array format for frontend
  return last12Months.map(month => ({
    month,
    revenue: monthlyData[month]
  }));
};

// Calculate ticket-wise revenue
const calculateTicketWiseRevenue = (orders, last12Months) => {
  const ticketData = {};

  // Initialize structure for all ticket types across all months
  orders.forEach(order => {
    if (order.paymentStatus === 'confirmed') {
      order.tickets.forEach(ticket => {
        const ticketType = ticket.ticketType;
        
        if (!ticketData[ticketType]) {
          ticketData[ticketType] = {
            ticketType: ticketType,
            monthlyRevenue: {},
            totalRevenue: 0,
            totalTicketsSold: 0
          };
          
          // Initialize all months with 0
          last12Months.forEach(month => {
            ticketData[ticketType].monthlyRevenue[month] = {
              revenue: 0,
              ticketsSold: 0
            };
          });
        }

        const orderMonth = order.createdAt.toISOString().slice(0, 7);
        const ticketRevenue = ticket.quantity * ticket.unitPrice;
        
        if (ticketData[ticketType].monthlyRevenue[orderMonth]) {
          ticketData[ticketType].monthlyRevenue[orderMonth].revenue += ticketRevenue;
          ticketData[ticketType].monthlyRevenue[orderMonth].ticketsSold += ticket.quantity;
        }
        
        ticketData[ticketType].totalRevenue += ticketRevenue;
        ticketData[ticketType].totalTicketsSold += ticket.quantity;
      });
    }
  });

  // Convert to frontend-friendly format
  const result = Object.values(ticketData).map(ticket => ({
    ticketType: ticket.ticketType,
    totalRevenue: ticket.totalRevenue,
    totalTicketsSold: ticket.totalTicketsSold,
    monthlyBreakdown: last12Months.map(month => ({
      month,
      revenue: ticket.monthlyRevenue[month].revenue,
      ticketsSold: ticket.monthlyRevenue[month].ticketsSold
    }))
  }));

  return result;
};

exports.createTicketType = async (req, res) => {
  const { name, quantity, ticketDescription, price, validity, options, eventId } = req.body

  try {
    if (!eventId) {
      return res.status(400).json({ message: "Event ID is required" });
    }

    const newTicket = await TicketType.create({
      eventId,
      name,
      quantity: quantity === "Unlimited" ? "10000" : quantity,
      ticketDescription,
      price,
      validity,
      options,
      createdBy: req.user._id  // Attach the user ID of the creator
    });

    res.status(201).json({
      message: "Ticket Type created successfully",
      ticketTypeId: newTicket._id,
      ticket: newTicket,
    });
  } catch (err) {
    res.status(500).json({
      message: "An error occurred while creating the ticket type",
      error: err.message
    });
  }
};

exports.updateTicketType = async (req, res) => {

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

    // Update TicketType
    const updatedTicketType = await TicketType.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // Update TicketConfiguration.tickets[]

    const configResult = await TicketConfiguration.updateOne(
      { "tickets.id": id },
      {
        $set: {
          "tickets.$.totalTickets": quantity,
          "tickets.$.price": price,
          "tickets.$.description": ticketDescription,
        },
      }
    );

    // Check if update matched any ticket inside TicketConfiguration
    if (configResult.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket found but not present in TicketConfiguration",
      });
    }

    if (configResult.modifiedCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes applied (values are already the same)",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      updatedTicketType,
      configUpdate: configResult,
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

exports.updateRefundPolicy = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      fullRefund,
      fullRefundDaysBefore,
      partialRefund,
      partialRefundPercent,
      noRefundAfterDate,
      noRefundDate,
      isRefundPolicyEnabled
    } = req.body;

    // Build refund policy object
    const refundPolicy = {
      fullRefund: fullRefund || false,
      fullRefundDaysBefore: fullRefundDaysBefore || "",
      partialRefund: partialRefund || false,
      partialRefundPercent: partialRefundPercent || "",
      noRefundAfterDate: noRefundAfterDate || false,
      noRefundDate: noRefundDate || null,
    };

    // Update the ticket configuration for the event
    const updated = await TicketConfiguration.findOneAndUpdate(
      { eventId },
      {
        refundPolicy,
        isRefundPolicyEnabled: isRefundPolicyEnabled || false,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Ticket configuration not found for this event.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Refund policy updated successfully.',
      data: updated
    });

  } catch (err) {
    console.error("Error updating refund policy:", err.message);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};