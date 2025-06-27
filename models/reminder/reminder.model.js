const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  reminders: {
    type: Map,
    of: Boolean,
    default: {
      '1 Week': true,
      '3 Days': true,
      '3 Hours': true
    }
  },
  eventDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }, sentReminders: {
    type: Map,
    of: Boolean,
    default: {}
  }

});

module.exports = mongoose.model('Reminder', reminderSchema);
