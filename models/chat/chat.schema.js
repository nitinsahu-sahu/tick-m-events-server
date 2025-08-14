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
    files: [{
        public_id: {
            type: String,
        },
        url: {
            type: String,
        },
        fileType: {
            type: String,
            enum: ['image', 'video', 'document', 'audio'],
            required: true
        },
        fileName: {
            type: String
        },
        fileSize: {
            type: Number
        }
    }],
    message: {
        type: String
    },
    type: {
        type: String,
        enum: ['text', 'file', 'mixed'], // 'mixed' for when both text and files are sent
        default: 'text'
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