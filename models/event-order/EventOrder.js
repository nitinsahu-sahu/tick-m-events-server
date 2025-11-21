// models/EventOrder.js
const mongoose = require("mongoose")
const { Schema } = mongoose

const addressSchema = new Schema({
    email: { type: String, required: true },
    number: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    hearAboutEvent: { type: String, required: true },
    eventSpacificInfo: { type: String },
});

const participantSchema = new Schema({
    name: { type: String, required: true },
    age: { type: String },
    gender: { type: String, required: true },
    validation: { type: Boolean, required: false, default: false },
    entryTime: { type: Date },
});

const eventOrderSchema = new Schema({
    fapshiExternalId: {
        type: String,
        required: false
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    orderAddress: addressSchema,
    participantDetails: [participantSchema],
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
        enum: ['pending', 'confirmed', 'denied','initiated'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'freeEvent', 'cod', 'orange_money', 'cash', 'mobile_money'],
        required: true
    },
    refundStatus: {
        type: String,
        enum: ['none', 'requestedRefund', 'cancelled'],
        default: 'none'
    },
    transactionId: {
        type: String,
        required: false
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
    deviceUsed: {
        type: String,
        enum: ['Smartphones', 'Tablets', 'Laptops', 'Desktops', 'Unknown'],
        default: 'Unknown'
    },
      financialTransId: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("EventOrder", eventOrderSchema);
