const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  flag: {
    type: String,
    default: 'contact'
  },

  transactionId: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['initiate', 'successful', 'failed', 'expired'],
    default: 'initiate'
  },
  paymentUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  paymentMethod: { type: String },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventReqId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventRequest' },
  placeABidId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlaceABid' },
  bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid' },
  bidAmount: { type: Number },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ContactPayment', paymentSchema);