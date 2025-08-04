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
        unique: true,
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
        max: 15,
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
        default: "",

    },
    address: {
        type: String,
        default: "",

    },
    website: {
        type: String,
        default: "",
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
    certified: {
        type: Boolean,
        default: false
    },
    contractsCount: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['organizer', 'admin', 'participant', 'provider'],
        default: 'participant'
    },
    status: {
        type: String,
        enum: ['pending', 'block', 'active', 'inActive'],
        default: 'pending'
    },
    serviceCategory: {
        type: String,
        default: ""
    },
    averageRating: {
        type: Number,
        default: 0
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    sessionStats: {
        totalHours: { type: Number, default: 0 }, // Total hours logged in
        today: {
            date: { type: String }, // "YYYY-MM-DD"
            hours: { type: Number, default: 0 }
        },
        history: [{
            date: { type: String }, // "YYYY-MM-DD"
            hours: { type: Number }
        }]
    },
    loginStats: {
        totalLogins: { type: Number, default: 0 },
        currentMonth: {
            count: { type: Number, default: 0 },
            lastLogin: { type: Date }
        },
        history: [{
            month: { type: String }, // Format: "YYYY-MM"
            count: { type: Number }
        }]
    },
    profileViews: {
        currentMonth: {
            count: { type: Number, default: 0 },
            viewers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
        },
        history: [{
            month: { type: String, required: true }, // Format: "YYYY-MM"
            count: { type: Number, required: true }
        }]
    },
    createdAt: { type: Date, default: Date.now },
    socketId: { type: String }
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

// Update average rating
userSchema.methods.updateAverageRating = async function () {
    const reviews = await mongoose.model("Review").find({ reviewedUserId: this._id });
    if (reviews.length === 0) {
        this.averageRating = 0;
        this.reviewCount = 0;
        const result = await this.save();
        return result;
    }
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = parseFloat((totalRating / reviews.length).toFixed(1));
    this.reviewCount = reviews.length;

    const result = await this.save();
    return result;
};
module.exports = mongoose.model("User", userSchema)