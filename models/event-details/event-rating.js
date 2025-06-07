const mongoose = require('mongoose');
const { Schema } = mongoose;

const ratingSchema = new Schema({
    eventId: { type: String, required: true },
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


module.exports = mongoose.model('eventRating', ratingSchema);