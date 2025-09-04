const mongoose = require('mongoose');

const socialMediaPostSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
   mediaType: {                
    type: String,
    enum: ['image', 'video'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['Facebook', 'WhatsApp', 'TikTok', 'X', 'LinkedIn'],
    required: true,
  },
  description: { type: String, required: true },
  reservationLink: { type: String, required: true },
  hashtag: { type: String },
  imageUrl: { type: String }, // optionally store image/video URL if uploaded
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SocialMediaPost', socialMediaPostSchema);
