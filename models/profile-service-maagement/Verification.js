const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailOtp: String,
  emailOtpExpires: Date,
  whatsappVerified: {
    type: Boolean,
    default: false
  },
  whatsappOtp: String,
  whatsappOtpExpires: Date,
  whatsappNumber: Number,
  identityVerified: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['passport', 'driving_license', 'national_id'],
    required: true
  },
  identityDocuments: [{
    url: String,
    public_id: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  paymentVerified: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Verification', verificationSchema);