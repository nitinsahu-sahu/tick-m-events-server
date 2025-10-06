const mongoose = require('mongoose');

const logoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Logo name is required'],
    trim: true,
    maxlength: [100, 'Logo name cannot exceed 100 characters']
  },
  image: {
    public_id: {
      type: String,
      required: [true, 'Public ID is required']
    },
    url: {
      type: String,
      required: [true, 'Image URL is required']
    },
    format: {
      type: String,
      required: true
    },
    bytes: {
      type: Number,
      required: true
    },
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    }
  },
  link: {
    type: String,
    required: [true, 'Logo link is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
logoSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Logo', logoSchema);