const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventSchema = new Schema({
  eventName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  category: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  coverImage: {
    public_id: { type: String, required: true },
    url: { type: String, required: true }
  },
  location: { type: String, required: true },
  format: {
    type: String,
    required: true,
  },
  description: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);