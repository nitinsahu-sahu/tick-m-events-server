const mongoose = require('mongoose');
const { Schema } = mongoose;

const visibilitySchema = new Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  visibilitySettings: {
    publicEvent: { type: Boolean, default: false },
    privateEvent: { type: Boolean, default: false }
  },
  customUrl: { type: String },
  enableHomepageHighlighting: { type: Boolean, default: false },
  autoShareOnSocialMedia: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Visibility', visibilitySchema);