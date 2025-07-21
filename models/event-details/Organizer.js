const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizerSchema = new Schema({
  eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
  name: { type: String, required: true },
  number: { type: String, required: true },
  email: { type: String, required: true },
  website: { type: String },
  socialMedia: {
    whatsapp: { type: String },
    linkedin: { type: String },
    facebook: { type: String },
    tiktok: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Organizer', organizerSchema);