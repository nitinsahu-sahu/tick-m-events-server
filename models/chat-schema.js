const mongoose = require("mongoose")
const { Schema } = mongoose

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  senderRole: { type: String, enum: ['admin', 'provider', 'participant', 'organizer'], required: true },
  receiverRole: { type: String, enum: ['admin', 'provider', 'participant', 'organizer'], required: true }
});

module.exports = mongoose.model("ChatSystem", messageSchema);
