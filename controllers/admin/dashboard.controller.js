const User = require('../../models/User');
const Event  = require('../../models/event-details/Event');
const TicketConfiguration  = require('../../models/event-details/Ticket');

exports.getDashbordData = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get total events count
    const totalEvents = await Event.countDocuments({ isDelete: false });
    
    // Get active providers count (status: 'active' and role: 'provider')
    const activeProviders = await User.countDocuments({ 
      role: 'provider', 
      status: 'active' 
    });
    
    // Calculate total revenue from all ticket configurations
    const allTicketConfigs = await TicketConfiguration.find()
      .populate('eventId', 'status') // Only populate status to check if event is approved
      .lean();
    
    let totalRevenue = 0;
    
    allTicketConfigs.forEach(config => {
      // Only count revenue from approved events
      if (config.eventId && config.eventId.status === 'approved') {
        config.tickets.forEach(ticket => {
          // Extract numeric value from price string (e.g., "5000 XAF" -> 5000)
          const priceStr = ticket.price.split(' ')[0];
          const price = parseFloat(priceStr) || 0;
          const quantity = parseInt(ticket.totalTickets) || 0;
          
          totalRevenue += price * quantity;
        });
      }
    });
    
    // Prepare response data
    const dashboardData = {
      totalUsers,
      totalEvents,
      activeProviders,
      totalRevenue: `${totalRevenue.toLocaleString()} XAF` // Format as currency
    };
    
    res.status(200).json({
      success: true,
      message: "Get data successfully...",
      dashboardData
    });
    
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};