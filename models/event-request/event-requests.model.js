const mongoose = require("mongoose")

// event-requests.model.js
const eventRequestSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  serviceCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventLocation: { type: String, required: true },
  status: {
    type: String,
    enum: ['accepted', 'requested-by-organizer', 'accepted-by-provider', 'rejected-by-provider', 'rejected-by-organizer', 'accepted-by-organizer'],
    default: 'requested-by-organizer'
  },
  contractStatus: {
    type: String,
    enum: ['pending', 'signed', 'ongoing', 'completed', 'cancelled'],
    default: 'pending'
  },
  orgBudget: {
    type: Number,
    required: true
  },
  orgRequirement: {
    type: String,
    required: true
  },
  
  orgAdditionalRequirement: {
    type: String,
  },
  discussion: {
    type: String,
  },
  providerResponse: { type: String },
  providerProposal: {
    amount: { type: Number },
    days: { type: Number },
    message: { type: String }
  },
  providerHasProposed: {
    type: Boolean,
    default: false
  },
  serviceTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('EventRequest', eventRequestSchema);