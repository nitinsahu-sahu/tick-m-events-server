// models/Promotion.js
const mongoose = require('mongoose');

const PromotionTypeSchema = new mongoose.Schema({
    percentageDiscount: {
        type: Boolean,
        default: false,
    },
    fixedValueDiscount: {
        type: Boolean,
        default: false,
    },
    groupOffer: {
        type: Boolean,
        default: false,
    },
    earlyBuyerDiscount: {
        type: Boolean,
        default: false,
    },
});

const PromotionSchema = new mongoose.Schema({
    promotionType: PromotionTypeSchema,
    discountValue: {
        type: String,
        required: true,
    },
    // ticketId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'TicketConfiguration',
    //     required: true,
    // },
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
    advantageType: {
        type: String,
        required: true,
    },
    usageLimit: {
        type: Number,
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
