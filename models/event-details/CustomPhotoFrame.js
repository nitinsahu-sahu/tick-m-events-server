const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomPhotoFrameSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    unique: true, 
  },
  frameUrls: {
    type: [String],
    default: [],
  },
  selectedFrameUrl: {
    type: String,
    default: null,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('CustomPhotoFrame', CustomPhotoFrameSchema);
