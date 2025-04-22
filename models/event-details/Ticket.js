// models/TicketConfiguration.js
const mongoose = require('mongoose');

const RefundPolicySchema = new mongoose.Schema({
  fullRefund: {
    type: Boolean,
    default: false,
  },
  fullRefundDaysBefore: {
    type: String,
    required: function () {
      return this.fullRefund === true;
    },
  },
  partialRefund: {
    type: Boolean,
    default: false,
  },
  partialRefundPercent: {
    type: String,
    required: function () {
      return this.partialRefund === true;
    },
  },
  noRefundAfterDate: {
    type: Boolean,
    default: false,
  },
  noRefundDate: {
    type: Date,
    required: function () {
      return this.noRefundAfterDate === true;
    },
  },
});

const TicketTypeSchema = new mongoose.Schema({
  ticketType: { type: String},
  id: { type: String },
  price: { type: String },
  totalTickets: { type: String },
  isUnlimitedSeat: { type: Boolean, default: false },
  description: { type: String},
  isLimitedSeat: { type: Boolean, default: true },   
  isLinkPramotion: { type: Boolean, default: false },
});

const TicketConfigurationSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  tickets: [TicketTypeSchema],
  purchaseDeadlineDate: { type: Date },
  isPurchaseDeadlineEnabled: { type: Boolean, default: true },
  paymentMethods: {
    type: String,
    enum: ['Mobile Money', 'Credit Card', 'Cash', 'Bank Transfer'],
    required: true,
  },
  refundPolicy: RefundPolicySchema,
  isRefundPolicyEnabled: { type: Boolean, default: false },
});

module.exports = mongoose.model('TicketConfiguration', TicketConfigurationSchema);
