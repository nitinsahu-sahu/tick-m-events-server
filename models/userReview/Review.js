const mongoose = require("mongoose");
const { Schema } = mongoose;

const reviewSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reviewedUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  reply: {
    text: String,
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    createdAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("Review", reviewSchema);