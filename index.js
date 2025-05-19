require("dotenv").config()
const express = require('express')
const cors = require('cors')
const http = require('http');
const morgan = require("morgan")
const cookieParser = require("cookie-parser")
const { connectToDB } = require("./database/db")
const { routesLists } = require("./utils/routerList")
const cloudinary = require('cloudinary').v2;
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const initReminderScheduler = require("./schedulers/reminderScheduler")
const socketIo = require('socket.io');
const Message = require('./models/chat-schema'); // Make sure you have this model

const port = process.env.PORT || 3000;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// server init
const app = express()

// database connection
connectToDB()

// middlewares
app.use(express.json())
app.use(cookieParser())
app.use(morgan("tiny"))
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
}));
app.use(cors({
    origin: [process.env.ORIGIN, process.env.ADMIN_ORIGIN],
    credentials: true,
    exposedHeaders: ['X-Total-Count'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
}))

// Dynamically register routes
for (const [prefix, router] of Object.entries(routesLists)) {
    app.use(prefix, router);
}

app.get("/", (req, res) => {
    res.status(200).json({ message: 'running' })
})

initReminderScheduler();

// Create HTTP server
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: [process.env.ORIGIN, process.env.ADMIN_ORIGIN],
    methods: ["GET", "POST"]
  }
});

// Store active users
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join user to their room
  socket.on('join', async ({ userId, role }) => {
    activeUsers.set(userId, { socketId: socket.id, role });
    socket.join(userId);
    console.log(`User ${userId} (${role}) joined chat`);
    
    // Send any unread messages
    const unreadMessages = await Message.find({
      receiver: userId,
      read: false
    }).populate('sender', 'name');
    
    unreadMessages.forEach(msg => {
      socket.emit('newMessage', {
        sender: msg.sender._id,
        senderName: msg.sender.name,
        content: msg.content,
        timestamp: msg.timestamp,
        senderRole: msg.senderRole
      });
      Message.updateOne({ _id: msg._id }, { read: true }).exec();
    });
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ sender, senderRole, receiver, content }) => {
    const receiverData = activeUsers.get(receiver);
    const receiverRole = receiverData?.role;
    
    // Save message to database
    const newMessage = new Message({
      sender,
      receiver,
      content,
      senderRole,
      receiverRole,
      read: !!receiverData
    });

    await newMessage.save();

    // If receiver is online, send the message
    if (receiverData) {
      io.to(receiverData.socketId).emit('newMessage', {
        sender,
        content,
        timestamp: new Date(),
        senderRole
      });
    }

    // Send back to sender for their own UI
    socket.emit('newMessage', {
      sender,
      content,
      timestamp: new Date(),
      senderRole,
      isOwn: true
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    for (let [userId, userData] of activeUsers.entries()) {
      if (userData.socketId === socket.id) {
        activeUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Start the combined server
server.listen(port, () => {
  console.log(`Server with Socket.io running on port ${port}`);
});