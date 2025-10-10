const mongoose = require('mongoose');

const NotificationTaskSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  emails: [String],
  phones: [String],
  subject: String,
  message: String,
  cta: String,
  ctalink: String,
  notificationType: { type: String, enum: ['email', 'sms', 'web-push'] },
  scheduledAt: Date,
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('NotificationTask', NotificationTaskSchema);
