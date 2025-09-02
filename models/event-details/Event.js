const mongoose = require('mongoose');
const { Schema } = mongoose;
const User = require("../User");
const Order = require("../event-order/EventOrder");
 

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
  validationOptions: {
    selectedView: {
      type: String,
      enum: ['scan', 'list'],
      default: 'scan'
    },
    listViewMethods: {
      type: [String],
      enum: ['manualCode', 'nameList', 'accountId'],
      default: []
    }
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

eventSchema.pre('save', async function (next) {
  try {
    if (this.isNew) return next();
 
    const dateChanged = this.isModified('date');
    const locationChanged = this.isModified('location');
    const timeChanged = this.isModified('time'); // 👈 Added
 
    let notificationMessage = null;
 
    if (dateChanged && locationChanged && timeChanged) {
      notificationMessage = `The date, time, and location for "${this.eventName}" have changed to ${this.date} at ${this.time}, ${this.location}`;
    } else if (dateChanged && locationChanged) {
      notificationMessage = `The date and location for "${this.eventName}" have changed to ${this.date} at ${this.location}`;
    } else if (dateChanged && timeChanged) {
      notificationMessage = `The date and time for "${this.eventName}" have changed to ${this.date} at ${this.time}`;
    } else if (locationChanged && timeChanged) {
      notificationMessage = `The location and time for "${this.eventName}" have changed to ${this.location} at ${this.time}`;
    } else if (dateChanged) {
      notificationMessage = `The date for "${this.eventName}" has changed to ${this.date}`;
    } else if (locationChanged) {
      notificationMessage = `The location of "${this.eventName}" has changed to ${this.location}`;
    } else if (timeChanged) {
      notificationMessage = `The time for "${this.eventName}" has changed to ${this.time}`;
    }
 
    if (notificationMessage) {
      const orders = await Order.find({ eventId: this._id }).populate('userId');
 
      for (const order of orders) {
        if (!order.userId) continue;
 
        // 🚨 Prevent duplicate notifications (same eventId + same message)
        await User.updateOne(
          {
            _id: order.userId._id,
            notifications: {
              $not: {
                $elemMatch: { eventId: this._id, message: notificationMessage }
              }
            }
          },
          {
            $push: {
              notifications: {
                message: notificationMessage,
                eventId: this._id,
                createdAt: new Date(),
                read: false
              }
            }
          }
        );
      }
 
      console.log(`🔔 Notification sent: ${notificationMessage}`);
    }
  } catch (err) {
    console.error("Error in event pre-save hook:", err);
  }
 
  next();
});

module.exports = mongoose.model('Event', eventSchema);