const Event = require('../../models/event-details/Event');
const Customization = require('../../models/event-details/Customization');
const TicketConfiguration = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const Organizer = require('../../models/event-details/Organizer');
const CancelledEventMsg = require('../../models/event-details/event-cancelled');
const mongoose = require('mongoose');


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
          Organizer.findOne({ eventId }),
          CancelledEventMsg.findOne({ eventId })
        ]);

        // Process the results of Promise.allSettled
        const [customization, tickets, visibility, organizer, cancelledEvent] = relatedData.map(result =>
          result.status === 'fulfilled' ? result.value : null
        );

        eventsWithDetails.push({
          event: event.toObject(),
          customization,
          tickets,
          visibility,
          organizer,
          cancelledEvent
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

// controllers/eventController.js
exports.deleteEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Verify the event belongs to the user
    const event = await Event.findOne({ _id: eventId });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or you are not authorized to delete it'
      });
    }

    // Soft delete by setting isDelete to true
    event.isDelete = true;
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Srever error.',
      error: error.message
    });
  }
};

exports.updateEvents = async (req, res, next) => {
  const userId = req.user._id;
  const { eventId } = req.params;
 
  try {
    // Verify the event exists and belongs to the user
    const existingEvent = await Event.findOne({ _id: eventId, createdBy: userId, isDelete: false });
 
    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or you do not have permission to update it'
      });
    }
 
    // Extract data from request body
    const {
      event,
      customization,
      tickets,
      visibility,
      organizer
    } = req.body;
 
    // Start a transaction to ensure all updates succeed or fail together
    const session = await mongoose.startSession();
    session.startTransaction();
 
    try {
      // Update Event data
      const existingEventDoc = await Event.findById(eventId).session(session);
 
      if (!existingEventDoc) {
        throw new Error('Event not found');
      }
 
      // Apply updates manually
      Object.assign(existingEventDoc, {
        ...event,
        updatedAt: new Date()
      });
 
      // This will now trigger the `pre('save')` hook
      await existingEventDoc.save({ session });
 
      const updatedEvent = existingEventDoc;
 
      // Update Customization data
      let updatedCustomization;
      if (customization) {
        updatedCustomization = await Customization.findOneAndUpdate(
          { eventId },
          customization,
          { new: true, upsert: true, session }
        );
      }
 
      // // Update Ticket Configuration
      let updatedTicketConfiguration;
      if (tickets) {
        updatedTicketConfiguration = await TicketConfiguration.findOneAndUpdate(
          { eventId },
          tickets,
          { new: true, upsert: true, session }
        );
      }
 
      // // Update Visibility
      let updatedVisibility;
      if (visibility) {
        updatedVisibility = await Visibility.findOneAndUpdate(
          { eventId },
          visibility,
          { new: true, upsert: true, session }
        );
      }
 
      // // Update Organizer
      let updatedOrganizer;
      if (organizer) {
        updatedOrganizer = await Organizer.findOneAndUpdate(
          { eventId },
          organizer,
          { new: true, upsert: true, session }
        );
      }
 
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
 
      // // Prepare response
      const response = {
        success: true,
        message: 'Event updated successfully',
        data: {
          event: updatedEvent,
          customization: updatedCustomization,
          ticketConfiguration: tickets,
          visibility: updatedVisibility,
          organizer: updatedOrganizer
        }
      };
 
      // // Remove null values from response
      Object.keys(response.data).forEach(key => {
        if (response.data[key] === null || response.data[key] === undefined) {
          delete response.data[key];
        }
      });
 
      return res.status(200).json(response);
 
    } catch (error) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
 
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the event',
      error: error.message
    });
  }
};

exports.updateEventVisibility = async (req, res, next) => {
  const userId = req.user._id;
  const { eventId } = req.params;
  const { visibilityState } = req.body;

  try {
    // Validate event exists and belongs to user
    const event = await Event.findOne({ _id: eventId, createdBy: userId });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or you are not authorized'
      });
    }

    // Find or create visibility settings
    let visibility = await Visibility.findOne({ eventId, _id: visibilityState._id });

    // Update fields
    if (visibilityState.visibilityType) visibility.visibilityType = visibilityState.visibilityType;
    if (visibilityState.customUrl) visibility.customUrl = visibilityState.customUrl;

    // Update promotion settings if provided
    if (visibilityState.promotionAndHighlight !== undefined) {
      visibility.promotionAndHighlight = visibilityState.promotionAndHighlight;
    }

    // Generate custom URL if visibility type changed to private
    if (visibilityState.visibilityType === 'private' && !visibilityState.customUrl) {
      visibility.customUrl = `https://tick-m-events.vercel.app/our-event/${eventId}`;
    }

    // Save changes
    await visibility.save();

    return res.status(200).json({
      success: true,
      message: 'Visibility settings updated successfully',
      data: visibility
    });

  } catch (error) {
    console.error('Error updating event visibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating visibility settings',
      error: error.message
    });
  }
};