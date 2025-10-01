const mongoose = require('mongoose');
const { Schema } = mongoose;

const milestoneSchema = new Schema({
  milestorneName: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'XAF' },
  isReleased: { type: Boolean, default: false }
});

const bidSchema = new Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlaceABid',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bidAmount: { type: Number, required: true },
  deliveryTime: { type: Number, required: true },
  deliveryUnit: {
    type: String,
    required: true,
    enum: ['Days', 'Weeks']
  },
  winningBid: {
    type: Number,
    default: 0
  },
  organizrAmount: {
    type: Number,
    default: 0
  },
  rejectionReason: {
    type: String,
    required: function () {
      return this.status === 'rejected';
    }
  },

  isOrgnizerAccepted: {
    type: Boolean,
    default: false
  },
  isProviderAccepted: {
    type: Boolean,
    default: false
  },
  proposal: {
    type: String,
    required: true,
    minlength: 50
  },
  milestones: [milestoneSchema],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  adminFeePaid: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);