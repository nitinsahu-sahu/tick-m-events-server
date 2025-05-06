const mongoose = require("mongoose");
const { Schema } = mongoose;

const ticketTypeSchema = new Schema({
  eventName: {
    type: String,
    required: [true, "Event Name is required"],
    trim: true,
  },
  availableQuantity: {
    type: Number,
    required: [true, "Available Quantity is required"],
    min: [1, "Minimum quantity should be 1"]
  },
  ticketDescription: {
    type: String,
    trim: true,
    required: [true, "Ticket Description is required"],
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price must be non-negative"],
  },
  validity: {
    type: Date,
    required: [true, "Validity date is required"],
  },
  options: {
    transferableTicket: {
      type: Boolean,
      default: false,
    },
    personalizedTicket: {
      type: Boolean,
      default: false,
    },
    activationCode: {
      type: Boolean,
      default: false,
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("TicketType", ticketTypeSchema);
