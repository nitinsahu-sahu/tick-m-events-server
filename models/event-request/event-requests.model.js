const mongoose = require("mongoose")

// event-requests.model.js
const eventRequestSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['accepted', 'requested-by-organizer', 'accepted-by-provider', 'rejected-by-provider', 'rejected-by-organizer'],
    default: 'requested-by-organizer'
  },
  message: String, // Custom message from organizer
  providerResponse: String, // Provider's response message
}, { timestamps: true });

module.exports = mongoose.model('EventRequest', eventRequestSchema);