const mongoose = require('mongoose');
const { Schema } = mongoose;

const customizationSchema = new Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  themeColor: { type: String, required: true },
  logo: { 
    public_id: { type: String, required: true },
    url: { type: String, required: true }
  },
  frame: { 
    type: String, 
    required: true,
    enum: ['circle', 'square', 'rounded']
  }
}, { timestamps: true });

module.exports = mongoose.model('Customization', customizationSchema);