// controllers/ticketController.js
const TicketConfiguration = require('../../models/event-details/Ticket');
const Event = require('../../models/event-details/Event');

// Create a new ticket configuration
exports.createTicketConfiguration = async (req, res) => {
  const {
    tickets,
    payStatus,
    purchaseDeadlineDate,
    isPurchaseDeadlineEnabled,
    paymentMethods,
    isRefundPolicyEnabled,
    fullRefundCheck,
    partialRefundCheck,
    noRefundAfterDateCheck,
    fullRefundDaysBefore,
    partialRefundPercent,
    noRefundDate
  } = req.body;
console.log(tickets);

  try {
    const { eventId } = req.params;
    const ticketList = JSON.parse(tickets);

    // Map tickets properly for TicketTypeSchema
    const formattedTickets = ticketList.map(ticket => ({
      ticketType: ticket.ticketType,
      id: ticket.id,
      price: ticket.price,
      totalTickets: ticket.totalTickets,
      description: ticket.description,
      isLimitedSeat: ticket.isLimitedSeat ?? true,
      isLinkPramotion: ticket.isLinkPramotion ?? false,
    }));

    const refundPolicy = {
      fullRefund: fullRefundCheck,
      fullRefundDaysBefore,
      partialRefund: partialRefundCheck,
      partialRefundPercent,
      noRefundAfterDate: noRefundAfterDateCheck,
      noRefundDate,
    };

    const ticketQuantity = formattedTickets.reduce((sum, ticket) => {
      return sum + (Number(ticket.totalTickets) || 0);
    }, 0);

    await Event.findByIdAndUpdate(
      { _id: eventId },
      { ticketQuantity, payStatus, step: 2 },
      { new: true }
    );

    const newConfig = new TicketConfiguration({
      eventId,
      tickets: formattedTickets,
      purchaseDeadlineDate,
      isPurchaseDeadlineEnabled,
      paymentMethods,
      refundPolicy,
      isRefundPolicyEnabled,
      payStatus,
      createdBy: req.user._id,
    });

    await newConfig.save();

    res.status(201).json({
      success: true,
      message: "Ticket configuration created successfully",
      ticketConfigId: newConfig._id,
    });
  } catch (error) {
    console.error("Error creating ticket configuration:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Optional: Get all ticket configurations
exports.getAllTicketConfigurations = async (req, res) => {
  try {
    const configs = await TicketConfiguration.find().populate('eventId');
    res.status(200).json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
};

// Optional: Get a specific config by eventId
exports.getTicketConfigByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const config = await TicketConfiguration.findOne({ eventId });

    if (!config) {
      return res.status(404).json({ success: false, message: 'Configuration not found' });
    }

    res.status(200).json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
