const User = require('../../models/User');
const Organizer = require('../../models/event-details/Organizer');
const Ticket = require('../../models/event-details/Ticket');
const EventOrders = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const mongoose = require('mongoose');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }); // Exclude admins
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.validateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = 'active';
    await user.save();

    res.status(200).json({ success: true, message: 'User validated successfully', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.blockUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = 'block';
    await user.save();

    res.status(200).json({ success: true, message: 'User blocked successfully...', data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.providerList = async (req, res) => {
  try {
    const providers = await User.find({
      role: 'provider'
    }).select('-socialLinks -experience -password -__v -cover -avatar -website')
    res.status(200).json({ success: true, message: 'Fetch provider sunccessfully...', providers });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Server error' });
  }
};

exports.getEventSummary = async (req, res) => {
  try {
    const events = await Event.find({
      isDelete: { $ne: true }
    })
      .sort({ date: 1 })
      .lean();

    const summary = await Promise.all(events.map(async (event) => {
      const organizer = await Organizer.findOne({ eventId: event._id }).select('name').lean();
      const ticketsData = await Ticket.findOne({ eventId: event._id }).lean();
      const orders = await EventOrders.find({ eventId: event._id }).lean();

      let totalSold = 0;
      let totalRevenue = 0;

      // Calculate tickets sold & revenue
      orders.forEach(order => {
        if (Array.isArray(order.tickets)) {
          orders.forEach(order => {
            if (Array.isArray(order.tickets)) {
              order.tickets.forEach(ticket => {
                const quantity = parseInt(ticket.quantity || "0", 10);
                const price = parseFloat(ticket.unitPrice || "0");

                totalSold += quantity;
                totalRevenue += quantity * price;
              });
            }
          });

        }
      });

      // Get total available tickets
      const totalAvailableTickets = ticketsData?.tickets?.reduce((acc, t) => {
        return acc + parseInt(t.totalTickets || "0", 10);
      }, 0) || 0;

      return {
        eventName: event.eventName,
        organizerName: organizer?.name || 'N/A',
        totalAvailableTickets,
        ticketsSold: totalSold,
        ticketsRemaining: totalAvailableTickets - totalSold,
        revenue: totalRevenue,
        status: event.status || 'N/A',
      };
    }));

    res.status(200).json({
      success: true,
      message: 'All event summaries fetched successfully.',
      data: summary
    });

  } catch (err) {
    console.error('Error in getEventSummary:', err.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};