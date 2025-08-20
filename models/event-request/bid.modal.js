const mongoose = require('mongoose');
const { Schema } = mongoose;

const milestoneSchema = new Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'XAF' }
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
  proposal: { 
    type: String, 
    required: true,
    minlength: 100
  },
  milestones: [milestoneSchema],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);