// models/UserFcmToken.js
const mongoose = require('mongoose');

const userFcmTokenSchema = new mongoose.Schema({
  email: { type: String, required: true },
  fcmToken: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserFcmToken', userFcmTokenSchema);
