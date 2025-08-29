const mongoose = require("mongoose")
const { Schema } = mongoose
const bcrypt = require("bcryptjs");
const RewardTransaction = require("./RewardTrans");


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

const sessionDurationSchema = new Schema({
    hours: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },
    seconds: { type: Number, default: 0 }
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
        totalDuration: sessionDurationSchema,
        today: {
            date: { type: String }, // "YYYY-MM-DD"
            duration: sessionDurationSchema
        },
        history: [{
            date: { type: String }, // "YYYY-MM-DD"
            duration: sessionDurationSchema
        }]
    },
    lastLoginTime: { type: Date },
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
    socketId: { type: String },
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    rewardPoints: {
        type: Number,
        default: 0
    },
    referralCount: {
        type: Number,
        default: 0
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    resetPasswordCode: String,
    resetCodeExpires: Date
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

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 10);

    // Generate referral code for participants
    if (this.role === 'participant' && !this.referralCode) {
        this.referralCode = await this.generateReferralCode();
    }
    next();
});

//Add a method to generate a unique referral code before saving:
userSchema.methods.generateReferralCode = async function () {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;

    while (!isUnique) {
        code = '';
        for (let i = 0; i < 8; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        // Check if code is unique
        const existingUser = await mongoose.model('User').findOne({ referralCode: code });
        if (!existingUser) {
            isUnique = true;
        }
    }

    return code;
};

//Add methods to handle rewards:
userSchema.methods.addRewardPoints = async function (points, reason) {
    this.rewardPoints += points;
    await this.save();

    // Create a reward transaction record (you'll need to create this model)
    await RewardTransaction.create({
        userId: this._id,
        points: points,
        type: 'credit',
        reason: reason
    });

    return this;
};

userSchema.statics.processReferral = async function (referralCode, userName) {
    try {
        // Find the referrer
        const referrer = await this.findOne({ referralCode, role: 'participant' });
        if (!referrer) {
            return { success: false, message: 'Invalid referral code' };
        }

        // Add reward points to referrer
        const rewardPoints = 100; // Adjust as needed
        await referrer.addRewardPoints(rewardPoints, `Referral bonus for ${userName}`);

        // Increment referral count
        referrer.referralCount += 1;
        await referrer.save();

        return {
            success: true,
            message: 'Referral processed successfully',
            referrerName: referrer.name
        };
    } catch (error) {
        console.error('Error processing referral:', error);
        return { success: false, message: 'Error processing referral' };
    }
};
module.exports = mongoose.model("User", userSchema)