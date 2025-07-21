const mongoose = require("mongoose");
const { Schema } = mongoose;

const replySchema = new Schema({
    message: { type: String },
    repliedAt: { type: Date, default: Date.now }
});

const eventReviewSchema = new Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
      },
    name: { type: String, required: true },
    email: { type: String, required: true },
    comment: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "block", "approved"],
        default: "pending"
    },
    reply: replySchema,
    createdAt: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

module.exports = mongoose.model("EventReview", eventReviewSchema);
