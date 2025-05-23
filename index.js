require("dotenv").config()
const express = require('express')
const User = require('./models/User');
const Message = require('./models/chat-schema');
const http = require('http');
const cors = require('cors')
const morgan = require("morgan")
const cookieParser = require("cookie-parser")
const { connectToDB } = require("./database/db")
const { routesLists } = require("./utils/routerList")
const cloudinary = require('cloudinary').v2;
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const initReminderScheduler = require("./schedulers/reminderScheduler")
const socketIo = require('socket.io');
// const cron = require("./schedulers/reminderScheduler");
const port = process.env.PORT || 3000;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// server init
const server = express()

// database connection
connectToDB()
// server.use(cron)
server.use(express.json())
server.use(cookieParser())
server.use(morgan("tiny"))
server.use(bodyParser.urlencoded({ extended: true }));
server.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));
// middlewares
const socketServer = http.createServer(server);
const io = socketIo(socketServer, {
  cors: {
    origin: "http://localhost:3039", // Update with your frontend URL
    methods: ["GET", "POST"]
  }
});
// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`New connection from: ${socket.handshake.headers.origin}`);
  console.log('New client connected:', socket.id);

  // Register user with their socket ID
  socket.on('socket-update', async (_id) => {
    try {
      const user = await User.findOneAndUpdate(
        { _id },
        { socketId: socket.id },
        { new: true }
      );
      if (!user) {
        console.log('User not found:', _id);
      }
    } catch (err) {
      console.error('Error updating socket ID:', err);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ senderId, receiverId, message }) => {
    try {
      // Validate sender and receiver
      const sender = await User.findOne({ _id: senderId });
      const receiver = await User.findOne({ _id: receiverId });

      if (!sender || !receiver) {
        console.log('Invalid sender or receiver');
        return;
      }

      // Check if participant is trying to message someone other than organizer
      if (sender.role === 'participant' && receiver.role !== 'organizer') {
        console.log('Participants can only message organizers');
        return;
      }

      // Save message to database
      const newMessage = new Message({
        senderId,
        receiverId,
        message
      });
      await newMessage.save();

      // Get receiver's socket ID
      const receiverSocketId = receiver.socketId;
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveMessage', {
          senderId,
          message,
          timestamp: newMessage.timestamp
        });
      }

      // Send confirmation to sender
      socket.emit('messageSent', {
        receiverId,
        message,
        timestamp: newMessage.timestamp
      });

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  // Get chat history
  socket.on('getChatHistory', async ({ userId, otherUserId }) => {
    try {
      const messages = await Message.find({
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      }).sort({ timestamp: 1 });

      socket.emit('chatHistory', messages);
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  });

  // Get all conversations for a user
  socket.on('getConversations', async (_id) => {
    try {
      const user = await User.findOne({ _id });
      if (!user) return;

      let query = {};
      if (user.role === 'participant') {
        // Participants can only see organizers
        query = { $or: [{ senderId: _id }, { receiverId: _id }] };
      } else if (user.role === 'organizer') {
        // Organizers can see all users who messaged them
        query = { $or: [{ receiverId: _id }, { senderId: _id }] };
      } else {
        // Admin and provider can see organizers
        query = {
          $or: [
            { senderId: _id, receiverRole: 'organizer' },
            { receiverId: _id, senderRole: 'organizer' }
          ]
        };
      }

      const conversations = await Message.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", userId] },
                "$receiverId",
                "$senderId"
              ]
            },
            lastMessage: { $last: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$receiverId", userId] },
                      { $eq: ["$read", false] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        { $sort: { "lastMessage.timestamp": -1 } }
      ]);

      // Populate user details
      const populatedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherUserId = conv._id;
          const otherUser = await User.findOne({ _id: otherUserId });
          return {
            userId: otherUserId,
            name: otherUser?.name || 'Unknown',
            role: otherUser?.role || 'unknown',
            lastMessage: conv.lastMessage,
            unreadCount: conv.unreadCount
          };
        })
      );

      socket.emit('conversations', populatedConversations);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  });

  // Mark messages as read
  socket.on('markAsRead', async ({ userId, otherUserId }) => {
    try {
      await Message.updateMany(
        { senderId: otherUserId, receiverId: userId, read: false },
        { $set: { read: true } }
      );
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.use(cors(
  {
    origin: [process.env.ORIGIN, process.env.ADMIN_ORIGIN],
    credentials: true,
    exposedHeaders: ['X-Total-Count'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  })
)

// Dynamically register routes
for (const [prefix, router] of Object.entries(routesLists)) {
  server.use(prefix, router);
}

server.get("/", (req, res) => {
  res.status(200).json({ message: 'running' })
})

socketServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// server.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

initReminderScheduler();
