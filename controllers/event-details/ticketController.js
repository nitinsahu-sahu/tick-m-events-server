// controllers/ticketController.js
const TicketConfiguration = require('../../models/event-details/Ticket');

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
  } = req.body

  try {
    const { eventId } = req.params
    const ticketList = JSON.parse(tickets)
    const refundPolicy= {
      fullRefund: fullRefundCheck,
      fullRefundDaysBefore: fullRefundDaysBefore,
      partialRefund: partialRefundCheck,
      partialRefundPercent: partialRefundPercent,
      noRefundAfterDate: noRefundAfterDateCheck,
      noRefundDate: noRefundDate
    }
    const newConfig = new TicketConfiguration({
      eventId,
      tickets:ticketList,
      purchaseDeadlineDate,
      isPurchaseDeadlineEnabled,
      paymentMethods,
      refundPolicy,
      isRefundPolicyEnabled,
      payStatus
    });

    await newConfig.save();

    res.status(201).json({
      success: true,
      message: 'Ticket configuration created successfully',
      ticketConfigId: newConfig._id,
    });
  } catch (error) {
    console.error('Error creating ticket configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
