const Reminder = require("../../models/reminder/reminder.model");
const Notification = require('../../models/reminder/notification.model');
const EventRequest = require("../../models/event-request/event-requests.model");
const mongoose = require("mongoose");

// Create or update reminder
exports.setRemindersForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reminders } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User not found." });
    }

    // Get existing reminder (if any)
    const existingReminder = await Reminder.findOne({ userId, eventId });

    let updateData = {
      userId,
      eventId,
      reminders
    };

    // If this is a new reminder or reminders have changed, reset sentReminders
    if (!existingReminder || JSON.stringify(existingReminder.reminders) !== JSON.stringify(reminders)) {
      updateData.sentReminders = {}; // reset
    }

    const updated = await Reminder.findOneAndUpdate(
      { userId, eventId },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Reminders updated successfully",
      data: updated
    });
  } catch (error) {
    console.error("Error setting reminders:", error);
    res.status(500).json({ success: false, message: "Server error while setting reminders" });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    // Populate eventId to get event details
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .populate('eventId', 'eventName date time location');

    const formatted = notifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.description,
      type: n.type || 'chat-message',
      isUnRead: n.isUnRead ?? true,
      avatarUrl: n.avatarUrl || null,
      postedAt: n.createdAt,

      // Add this line to show the eventId
      eventId: n.eventId?._id || n.eventId || null,

      eventDetails: n.eventId && typeof n.eventId === 'object'
        ? {
          name: n.eventId.eventName,
          date: n.eventId.date,
          time: n.eventId.time,
          location: n.eventId.location,
        }
        : null,
    }));


    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching notifications' });
  }
};

// Mark all notifications as read for the current user
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    // Update all notifications of this user where isUnRead is true to false
    await Notification.updateMany(
      { userId, isUnRead: true },
      { $set: { isUnRead: false } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error while marking notifications as read' });
  }
};

// Get reminders for a specific event
exports.getRemindersForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const reminder = await Reminder.findOne({ eventId });

    res.status(200).json({
      success: true,
      data: reminder || {}
    });
  } catch (error) {
    console.error("Error fetching reminder:", error);
    res.status(500).json({ success: false, message: "Server error while fetching reminder" });
  }
};

// Delete reminder for an event
exports.deleteRemindersForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    await Reminder.deleteOne({ eventId });

    res.status(200).json({
      success: true,
      message: "Reminders deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting reminders:", error);
    res.status(500).json({ success: false, message: "Server error while deleting reminder" });
  }
};
