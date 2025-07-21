const mongoose = require('mongoose');
const { Schema } = mongoose;

const customizationSchema = new Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  ticketCustomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketConfiguration',
    required: true,
  },
  themeColor: { type: String },
  customColor: { type: String },
  eventLogo: {
    public_id: { type: String, required: true },
    url: { type: String, required: true }
  },
  frame: {
    type: String,
    enum: ['circle', 'square', 'rounded', 'triangle']
  }
}, { timestamps: true });

module.exports = mongoose.model('Customization', customizationSchema);