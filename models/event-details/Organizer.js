const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizerSchema = new Schema({
  eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address`
    }
  },
  number: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number`
    }
  },
  website: { type: String },
  socialMedia: {
    whatsapp: { type: String },
    linkedin: { type: String },
    facebook: { type: String },
    tiktok: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Organizer', organizerSchema);