const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, 
  title: String,
  description: String,
  isUnRead: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);



// const notificationSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   title: String,
//   description: String,
//   type: { type: String, default: 'chat-message' }, 
//   avatarUrl: String, // if available
//   isUnRead: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now },
// });

// // ✅ Add this to format the response properly
// notificationSchema.set('toJSON', {
//   virtuals: true,
//   versionKey: false,
//   transform: (_, ret) => {
//     ret.id = ret._id;
//     delete ret._id;
//   },
// });

// module.exports = mongoose.model('Notification', notificationSchema);
