const mongoose = require("mongoose");
const { Schema } = mongoose;

const userServiceRequestSchema = new Schema({
    serviceName: {
        type: String,
        required: [true, "Service Name is required"],
        trim: true,
    },
    location: {
        type: String,
        required: [true, "Locaion is required"],
        min: [3, "Minimum letter should be 3"]
    },
    budget: {
        type: String,
        required:true
    },
    description: {
        type: String,
        required: [true, "Description is required"],
    },
    serviceImage: {
        public_id: { type: String },
        url: { type: String }
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

module.exports = mongoose.model("UserServiceRequest", userServiceRequestSchema);
