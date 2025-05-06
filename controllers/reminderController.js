// controllers/reminderController.js
const ReminderSetting = require('../models/ReminderSetting');

// Controller to save reminder settings
const saveReminderSettings = async (req, res) => {
  
  try {
    const {
      eventDate,
      reminderTime,
      notificationMethod,
      notificationType,
      recipient,
      customMessage,
      ctaButton
    } = req.body;
    
    const parsedEventDate = new Date(eventDate); 
    if (isNaN(parsedEventDate)) {
      return res.status(400).json({ error: "Invalid eventDate format." });
    }
    const reminder = new ReminderSetting({
      eventDate: parsedEventDate,
      reminderTime,
      notificationMethod,
      notificationType,
      recipient,
      customMessage,
      ctaButton
    });

    await reminder.save();

    res.status(200).json({ message: 'Reminder settings saved successfully!' });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    res.status(500).json({ error: 'Failed to save reminder settings' });
  }
};

module.exports = {
  saveReminderSettings
};
