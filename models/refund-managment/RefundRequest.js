const mongoose = require('mongoose');

const RefundRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EventOrder',
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  isAdminForwrd: {
    type: Boolean,
    default: false
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'refunded', 'cancelled', 'processed'],
    default: 'pending'
  },
  tickets: [
    {
      ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      ticketType: String,
      quantity: Number,
      unitPrice: Number
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  refundAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  adminNotes: {
    type: String,
  },
  reason: {
    type: String
  },
  refundPolicy: {
    fullRefund: Boolean,
    fullRefundDaysBefore: String
  },
  eventDate: {
    type: Date,
    required: true
  },
   refundTransactionId:{
    type: String,
    default: null,
    sparse: true,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('RefundRequest', RefundRequestSchema);
