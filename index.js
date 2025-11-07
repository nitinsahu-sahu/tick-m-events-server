require("dotenv").config()
const express = require('express')
const cors = require('cors')
const morgan = require("morgan")
const cookieParser = require("cookie-parser")
const { connectToDB } = require("./database/db")
const { routesLists } = require("./utils/routerList")
const cloudinary = require('cloudinary').v2;
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const User = require('./models/User');
const errorHandler  = require('./utils/errorHandler');
const initReminderScheduler = require("./schedulers/reminderScheduler")
const timezoneMiddleware = require('./middleware/timezoneMiddleware');
// const cron = require("./schedulers/reminderScheduler");
const port = process.env.PORT || 3000;
const SOCKET_PORT = process.env.SOCKET_PORT || 8000;

const io = require('socket.io')(SOCKET_PORT, {
  cors: {
    origin: process.env.ADMIN_ORIGIN,
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// server init
const server = express()
server.use(errorHandler)
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
// server.use(timezoneMiddleware);

server.use(cors(
  {
    origin: [process.env.ORIGIN, process.env.ADMIN_ORIGIN],
    credentials: true,
    exposedHeaders: ['X-Total-Count'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', "PUT"]
  })
)

// Dynamically register routes
for (const [prefix, router] of Object.entries(routesLists)) {
  server.use(prefix, router);
}

let users = [];
// Update your socket.io implementation like this:
io.on('connection', socket => {
  socket.on('addUser', userId => {
    const isUserExist = users.find(user => user.userId === userId);
    if (!isUserExist && userId) {
      const user = { userId, socketId: socket.id };
      users.push(user);
      io.emit('getUsers', users);
    }
  });

  socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId,updatedAt,type,files }) => {
    const receiver = users.find(user => user.userId === receiverId);
    const sender = users.find(user => user.userId === senderId);
    const user = await User.findById(senderId);
    
    if (!user) return;

    const messageData = {
      senderId,
      message,
      conversationId,
      receiverId,
      updatedAt,
      type,
      files,
      user: {
        _id: user._id,
        fullname: user.name,
        email: user.email,
        profile: user.avatar
      }
    };
    console.log(messageData);
    
    // Always emit to sender
    if (sender) {
      io.to(sender.socketId).emit('getMessage', messageData);
    }

    // Emit to receiver if online
    if (receiver) {
      io.to(receiver.socketId).emit('getMessage', messageData);
    }
  });

  socket.on('disconnect', () => {
    users = users.filter(user => user.socketId !== socket.id);
    io.emit('getUsers', users);
  });
});

server.get("/", (req, res) => {
  res.status(200).json({ message: 'running' })
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

initReminderScheduler();
