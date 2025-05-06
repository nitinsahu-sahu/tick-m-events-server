// models/ReminderSetting.js
const mongoose = require('mongoose');

const ReminderSettingSchema = new mongoose.Schema({
  eventDate: {
    type: Date,
    required: true,

  },
  sent: {
    type: Boolean,
    default: false
  },
  reminderTime: {
    type: Number,
    required: true
  },
  notificationMethod: {
    type: String,
    required: true
  },
  // notificationType: {
  //   type: String,
  //   required: true
  // },
  recipient: {
    type: String,
    default: 'all'
  },
  customMessage: {
    type: String,
    default: ''
  },
  ctaButton: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReminderSetting', ReminderSettingSchema);
