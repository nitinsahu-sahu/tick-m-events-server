const mongoose = require("mongoose")

// event-requests.model.js
const eventRequestSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  serviceCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventLocation: { type: String, required: true },
  providerStatus: {
    type: String,
    enum: ['accepted', 'pending', 'rejected'],
    default: 'pending'
  },
  orgStatus: {
    type: String,
    enum: ['accepted', 'request', 'rejected'],
    default: 'request'
  },
  isSigned: {
    type: Boolean,
    default: false
  },
  winningBid: {
    type: Number,
    default: 0
  },
  projectStatus: {
    type: String,
    enum: ['pending', 'ongoing', 'completed', 'cancelled'],
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