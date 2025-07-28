const mongoose = require("mongoose")

// event-requests.model.js
const signedContractSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest', required: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    eventReqId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventRequest', required: true },
    service: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    eventTime: {
        type: String,
        required: true
    },
    finalBudget: {
        type: String,
        required: true
    },
    explainReq: {
        type: String,
        required: true
    },
    contractStatus: {
        type: String,
        enum: ['signed', 'ongoing', 'completed'],
        default: 'signed'
    },
}, { timestamps: true });

module.exports = mongoose.model('SignedContract', signedContractSchema);