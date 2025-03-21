require('dotenv').config()
const mongoose=require("mongoose")

exports.connectToDB=async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('Database connected successfully.');
    } catch (error) {
        console.log(error);
    }
}
