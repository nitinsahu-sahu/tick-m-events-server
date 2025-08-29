const mongoose = require("mongoose")
const { Schema } = mongoose

const rewardTransactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  reference: {
    type: Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['User', 'Order', 'Other']
  }
}, { timestamps: true });

module.exports = mongoose.model('RewardTransaction', rewardTransactionSchema);