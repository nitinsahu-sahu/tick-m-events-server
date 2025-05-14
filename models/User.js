const mongoose = require("mongoose")
const { Schema } = mongoose
const bcrypt = require("bcryptjs");


const SocialLinksSchema = new mongoose.Schema({
    instagram: {
        type: String,
    },
    facebook: {
        type: String,
    },
    linkedin: {
        type: String,
    },
    tiktok: {
        type: String,
    },
});

const userSchema = new Schema({
    socialLinks: SocialLinksSchema,
    username: {
        type: String,
    },
    name: {
        type: String,
        required: [true, "Please Enter Your Name"],
    },
    email: {
        type: String,
        unique: true,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: [true, "Please Enter Your Gender"],
    },
    number: {
        type: String,
        trim: true,
        max: 10,
        unique: true,
        default: "XXXXX XXXXX",
        required: [true, "Please Enter Your Number"],

    },
    password: {
        type: String,
        required: [true, "Please Enter Your Password"],
        minLength: [8, "Password should have atleast 8 chars"],
    },
    experience: {
        type: String,
    },
    address: {
        type: String,
    },
    website: {
        type: String,
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
    cover: {
        public_id: {
            type: String,
            default: "cover/profile-cover",  // Set default Cloudinary public_id
        },
        url: {
            type: String,
            default: "https://res.cloudinary.com/dm624gcgg/image/upload/v1745399695/a33ffade6c44792172af87c950e914099ba87c45_dg1rab.png",  // Default avatar URL
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
        enum: ['organizer', 'admin', 'participant', 'provider'],
        default: 'participant'
    },
    status: {
        type: String,
        enum: ['block', 'active', 'inActive'],
        default: 'active'
    },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true })

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema)