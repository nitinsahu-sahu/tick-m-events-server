const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CONVERSATION",
        required: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    message: {
        type: String
    },
    type: {
        type: String
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    senderDeleteStatus: {
        type: String,
        enum: ['0', '1'],
        default: '0'
    },
    receiverDeleteStatus: {
        type: String,
        enum: ['0', '1'],
        default: '0'
    }
}, { timestamps: true });

const Messages = mongoose.model('Message', messageSchema);

module.exports = Messages;