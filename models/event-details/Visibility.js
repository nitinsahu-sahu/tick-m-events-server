const mongoose = require('mongoose');
const { Schema } = mongoose;

const visibilitySchema = new Schema({
  eventId: { type: String, required: true },
  ticketCustomId: { type: String, required: true },
  eventCustomizationId: { type: String, required: true },
  visibilitySettings: {
    publicEvent: { type: Boolean, default: false },
    privateEvent: { type: Boolean, default: false }
  },
  customUrl: { type: String },
  promotionAndHighlight: {
    homepageHighlighting: { type: Boolean, default: false },
    autoShareOnSocialMedia: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['publish', 'draft'],
    default: "publish",
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Visibility', visibilitySchema);