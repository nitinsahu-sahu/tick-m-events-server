const mongoose = require("mongoose")

// event-requests.model.js
const eventRequestSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerService: { type: mongoose.Schema.Types.ObjectId, ref: 'ProviderService', required: true },
  status: { 
    type: String, 
    enum: ['accept', 'accepted-by-provider', 'rejected-by-provider', 'requested-by-organizer', 'rejected-by-organizer'],
    default: 'requested-by-organizer'
  },
  message: String, // Custom message from organizer
  providerResponse: String, // Provider's response message
}, { timestamps: true });

module.exports = mongoose.model('EventRequest', eventRequestSchema);