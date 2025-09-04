// models/TicketConfiguration.js
const mongoose = require('mongoose');

const RefundPolicySchema = new mongoose.Schema({
  fullRefund: {
    type: Boolean,
    default: false,
  },
  fullRefundDaysBefore: {
    type: String,
  },
  partialRefund: {
    type: Boolean,
    default: false,
  },
  partialRefundPercent: {
    type: String,
    // required: function () {
    //   return this.partialRefund === true;
    // },
  },
  noRefundAfterDate: {
    type: Boolean,
    default: false,
  },
  noRefundDate: {
    type: Date,
    // required: function () {
    //   return this.noRefundAfterDate === true;
    // },
  },
});

const TicketTypeSchema = new mongoose.Schema({
  ticketType: { type: String, required: true },
  id: {
    type: mongoose.Schema.Types.ObjectId,  
    ref: "TicketType",                      
    required: true
  },
  price: { type: String, default: "0 XAF" },
  totalTickets: { type: String },
  description: { type: String ,required: true},
  isLimitedSeat: { type: Boolean, default: true },
  isLinkPramotion: { type: Boolean, default: false },
});

const TicketConfigurationSchema = new mongoose.Schema({
  eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
  tickets: [TicketTypeSchema],
  payStatus: {
    type: String,
    enum: ['free', 'paid'],
    default: "paid",
  },
  purchaseDeadlineDate: { type: Date },
  isPurchaseDeadlineEnabled: { type: Boolean, default: true },
  paymentMethods: {
    type: String,
  },
  refundPolicy: RefundPolicySchema,
  isRefundPolicyEnabled: { type: Boolean, default: false },
});

module.exports = mongoose.model('TicketConfiguration', TicketConfigurationSchema);
