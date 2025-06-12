// models/Activity.js
import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activityType: {
    type: String,
    required: true,
    enum: ['login', 'logout', 'event_created', 'ticket_purchased', 'profile_updated', 'password_changed']
  },
  description: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Activity', activitySchema);