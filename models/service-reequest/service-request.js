const mongoose = require("mongoose");
const { Schema } = mongoose;

const serviceRequestSchema = new Schema({
    serviceType: {
        type: String,
        required: [true, "Service Type is required"],
        trim: true,
    },
    eventLocation: {
        type: String,
        required: [true, "Locaion is required"],
        min: [3, "Minimum letter should be 3"]
    },
    dateAndTime: {
        type: String,
        required: [true, "Date and time is required"],
    },
    budget: {
        type: Number,
        required: [true, "Budget is required"],
        min: [0, "Budget must be non-negative"],
    },
    description: {
        type: String,
        required: [true, "Description is required"],
    },
    additionalOptions: {
        type: String,
    },
    coverImage: {
        public_id: { type: String, required: true },
        url: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ['inActice', 'active', 'draft'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
