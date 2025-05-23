// models/Promotion.js
const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
    promotionType: {
        type: String,
        enum: ['percentageDiscount', 'fixedValueDiscount', 'groupOffer', 'earlyBuyerDiscount'],
        required: true
    },
    discountValue: {
        type: String,
        required: true,
    },
    ticketSelection: {
        type: String,
        required: true,
    },
    validityPeriodStart: {
        type: String,
        required: true,
    },
    validityPeriodEnd: {
        type: String,
        required: true,
    },
    promoCode: {
        type: String,
        default: null,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: ['block', 'active', 'inActive'],
        default: 'active'
    },
    createdAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('Promotion', PromotionSchema);
