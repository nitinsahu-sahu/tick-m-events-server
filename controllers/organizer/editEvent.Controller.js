const Event = require('../../models/event-details/Event');
const Customization = require('../../models/event-details/Customization');
const TicketConfiguration = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const Organizer = require('../../models/event-details/Organizer');


exports.getUserEventsWithDetails = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all non-deleted events created by the user
    const events = await Event.find({ 
      createdBy: userId, 
      isDelete: false 
    }).sort({ createdAt: -1 });

    if (!events || events.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No events found for this user',
        data: []
      });
    }

    const eventsWithDetails = [];

    for (const event of events) {
      const eventId = event._id.toString();
      
      try {
        const relatedData = await Promise.allSettled([
          Customization.findOne({ eventId }),
          TicketConfiguration.findOne({ eventId }),
          Visibility.findOne({ eventId }),
          Organizer.findOne({ eventId })
        ]);

        // Process the results of Promise.allSettled
        const [customization, tickets, visibility, organizer] = relatedData.map(result => 
          result.status === 'fulfilled' ? result.value : null
        );

        eventsWithDetails.push({
          event: event.toObject(),
          customization,
          tickets,
          visibility,
          organizer
        });
      } catch (error) {
        // Still include the event even if some details failed to load
        eventsWithDetails.push({
          event: event.toObject(),
          customization: null,
          tickets: null,
          visibility: null,
          organizer: null,
          error: 'Failed to load some event details'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Events with details fetched successfully',
      eventsWithDetails
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Server error',
    });
  }
};