// models/EventOrder.js
const mongoose = require("mongoose")
const { Schema } = mongoose

const eventOrderSchema = new Schema({
    eventId: { type: String, required: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    tickets: [
        {
            ticketId: { type: String, required: true },
            ticketType: { type: String, required: true }, // "VIP", "Super"
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
            subtotal: { type: Number, required: true }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'paypal', 'upi', 'cod'],
        required: true
    },
    transactionId: {
        type: String,
        required: true
    },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("EventOrder", eventOrderSchema);
