const mongoose = require("mongoose")
const Category = require("../event-details/Category");

// event-requests.model.js
const placeABidSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    categoryId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category',
        required: true
    },
    subcategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        validate: {
            validator: async function(value) {
                const category = await Category.findOne({
                    _id: this.categoryId,
                    'subcategories._id': value
                });
                return !!category;
            },
            message: 'Subcategory does not belong to the specified category'
        }
    },
    eventLocation: { type: String, required: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'signed', 'ongoing', 'completed', 'cancelled'],
        default: 'pending'
    },
    orgBudget: {
        type: String,
        required: true
    },
    orgRequirement: {
        type: String,
        required: true
    },

    orgAdditionalRequirement: {
        type: String,
    },
    discussion: {
        type: String,
    },
    providerResponse: { type: String },
    providerProposal: {
        amount: { type: Number },
        days: { type: Number },
        message: { type: String }
    },
    providerHasProposed: {
        type: Boolean,
        default: false
    },
    serviceTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PlaceABid', placeABidSchema);