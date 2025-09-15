// require('dotenv').config()
// const mongoose = require("mongoose")

// exports.connectToDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI)
//         console.log('Database connected successfully.');
//     } catch (error) {
//         console.log('MongoDB Error', error);
//     }
// }

require('dotenv').config();
const mongoose = require("mongoose");

exports.connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout after 5s if no server
    });
    console.log('✅ Database connected successfully.');
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
  }
};
