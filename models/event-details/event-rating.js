const mongoose = require('mongoose');
const { Schema } = mongoose;

const ratingSchema = new Schema({
    eventId: { type: String, required: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    ratingValue: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Ensure one rating per user per event
ratingSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('eventRating', ratingSchema);