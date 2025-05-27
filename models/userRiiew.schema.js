const mongoose = require("mongoose");
const { Schema } = mongoose;

const replySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  repliedAt: { type: Date, default: Date.now }
});

const userReviewSchema = new Schema({
  reviewer: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
  },
  reviewedUser: { 
    type: String, 
    required: true 
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  reply: replySchema,
  status: {
    type: String,
    enum: ["pending", "rejected", "approved"],
    default: "approved"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
userReviewSchema.index({ reviewer: 1, reviewedUser: 1 });

module.exports = mongoose.model("UserReview", userReviewSchema);