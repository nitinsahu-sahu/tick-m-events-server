const mongoose = require("mongoose")
const { Schema } = mongoose

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, "Please Enter Your Name"],
    },
    email: {
        type: String,
        unique: true,
        required: [true, "Please Enter Your Email"],
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
    },
    number: {
        type: String,
        trim: true,
        max: 10,
        unique: true,
        default: "XXXXX XXXXX"
    },
    password: {
        type: String,
        required: [true, "Please Enter Your Password"],
        minLength: [8, "Password should have atleast 8 chars"],
    },
    avatar: {
        public_id: {
            type: String,
            default: "avatars/pmqlhyz1ehcipviw3ren",  // Set default Cloudinary public_id
        },
        url: {
            type: String,
            default: "https://res.cloudinary.com/dm624gcgg/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1728997240/avatars/pmqlhyz1ehcipviw3ren.jpg",  // Default avatar URL
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['guest', 'admin', 'superadmin', 'vendor'],
        default: 'guest'
    },
    status: {
        type: String,
        enum: ['block', 'active', 'inActive'],
        default: 'active'
    },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)