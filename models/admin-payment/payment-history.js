const mongoose = require("mongoose")

// event-requests.model.js
const adminPaymentHistorySchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventReqId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventRequest' },
    placeABidId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlaceABid' },
    bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid' },
    transactionId: {
        type: String
    },
    feeAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
    },
}, { timestamps: true });

module.exports = mongoose.model('adminPaymentHistory', adminPaymentHistorySchema);