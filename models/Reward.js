const { Schema } = mongoose


const rewardSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  pointsRequired: {
    type: Number,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_ticket'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expirationDate: Date,
  tierEligibility: [{
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
  }]
});
module.exports = mongoose.model("Reward", rewardSchema)
