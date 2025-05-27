// models/EventOrder.js
const mongoose = require("mongoose")
const { Schema } = mongoose

const addressSchema = new Schema({
    name: { type: String, required: true, },
    email: { type: String, required: true, },
    number: { type: String, required: true, },
    city: { type: String, required: true, },
    gender: { type: String, required: true, },
    age: { type: String, required: true, },
    hearAboutEvent: { type: String },
    eventSpacificInfo: { type: String },
});

const eventOrderSchema = new Schema({
    eventId: { type: String, required: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    orderAddress: addressSchema,
    qrCode: { type: String }, // Base64 image
    tickets: [
        {
            ticketId: { type: String, required: true },
            ticketType: { type: String, required: true }, // "VIP", "Super"
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
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
    verifyEntry: {
        type: Boolean,
        default: false,
    },
    ticketCode: {
        type: String,
        required: true,
        unique: true,
    },
    entryTime: {  // Add this new field
        type: Date
    },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("EventOrder", eventOrderSchema);
