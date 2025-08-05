const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventSchema = new Schema({
  eventName: {
    type: String,
    required: [true, 'Event name is required'],
    maxlength: [100, 'Event name cannot exceed 100 characters']
  },
  date: {
    type: String,
    required: [true, 'Date is required'],
    validate: {
      validator: function (v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v); // Simple date format validation
      },
      message: props => `${props.value} is not a valid date format (YYYY-MM-DD)`
    }
  },
  time: { type: String, required: true },
  category: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  validationView: {
    type: [String],
    enum: ['scan', 'listCode', 'listName'],
    default: 'scan',
  },
  averageRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  coverImage: {
    public_id: { type: String, required: true },
    url: { type: String, required: true }
  },
  portraitImage: {
    public_id: { type: String },
    url: { type: String }
  },
  location: { type: String, required: true },
  ticketQuantity: { type: String },
  soldTicket: { type: Number },
  format: {
    type: String,
    required: true,
  },
  description: { type: String, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'cancelled'],
    default: 'pending',
  },
  isDelete: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);