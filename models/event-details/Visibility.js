const mongoose = require('mongoose');
const { Schema } = mongoose;

const visibilitySchema = new Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  eventCustomizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customization',
    required: true,
  },
  ticketCustomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketConfiguration',
    required: true,
  },
  visibilityType: {
    type: String,
    enum: ['public', 'private'],
    default: "public",
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