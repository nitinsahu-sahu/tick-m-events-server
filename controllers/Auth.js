const User = require("../models/User");
const Review = require("../models/userReview/Review");
const bcrypt = require('bcryptjs');
const { sendMail } = require("../utils/Emails");
const { generateOTP } = require("../utils/GenerateOtp");
const Otp = require("../models/OTP");
const { sanitizeUser } = require("../utils/SanitizeUser");
const { generateToken } = require("../utils/GenerateToken");
const PasswordResetToken = require("../models/PasswordResetToken");
const UserServiceRequest = require("../models/profile-service-maagement/add-service");
const { generateUsername } = require("../utils/generate-username");
const cloudinary = require('cloudinary').v2;
const Activity = require("../models/activity/activity.modal");
const sharp = require('sharp');
const getLocationFromIP = require('../utils/getLocationFromIP');
const calculateDuration = require('../utils/helperFunction');
const { createResendOtpTemplate, resetPasswordSuccessfullyTemplate } = require('../utils/Emails-template');

// Generate random 6-digit code
const generateResetCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

//register controller
exports.signup = async (req, res) => {
    const { address, name, email, password, gender, number, role, experience, serviceCategory, referralCode } = req.body;
    const { avatar } = req.files;

    // Input validation
    if (!name || !email || !password || !gender || !number || !avatar) {
        return res.status(400).json({
            success: false,
            message: "All fields are required including avatar"
        });
    }

    const username = generateUsername(name, 5);

    try {
        // Check for existing user in a single query
        const existingUser = await User.findOne({
            $or: [{ email }, { number }]
        });

        if (existingUser) {
            const message = existingUser.email === email
                ? "Email already registered"
                : "Phone number already registered";
            return res.status(400).json({ success: false, message });
        }

        let referrer = null;
        // Validate referral code if provided
        if (referralCode) {
            referrer = await User.findOne({
                referralCode,
                role: 'participant'
            });

            if (!referrer) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid referral code"
                });
            }
        }

        // Upload avatar to Cloudinary
        let cloudinaryResult;
        try {
            cloudinaryResult = await cloudinary.uploader.upload(avatar.tempFilePath, {
                folder: "profile",
                width: 150,
                crop: "scale",
                resource_type: "auto"
            });
        } catch (uploadError) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload profile picture"
            });
        }

        // Create user data object
        const userData = {
            name,
            username,
            email,
            password,
            gender,
            address,
            number,
            avatar: {
                public_id: cloudinaryResult.public_id,
                url: cloudinaryResult.secure_url
            },
            role,
            experience,
            serviceCategory
        };

        // Only add referredBy if referrer exists
        if (referrer) {
            userData.referredBy = referrer._id;
        }

        // Create and save user
        const newUser = await User.create(userData);

        // Process referral reward if applicable
        // if (referrer) {
        //     await User.processReferral(referralCode, newUser.name);

        // }

        // Omit sensitive data in response
        const userResponse = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            avatar: newUser.avatar.url
        };

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: userResponse
        });

    } catch (error) {
        console.error('Signup error:', error.message);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error during registration"
        });
    }
};

//validate referral
exports.validateReffral = async (req, res) => {
    try {
        const { code } = req.params;

        const referrer = await User.findOne({
            referralCode: code,
            role: 'participant'
        });

        if (!referrer) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Valid referral code',
            referrerName: referrer.name
        });
    } catch (error) {
        console.error('Error validating referral code:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error validating referral code'
        });
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const startTime = Date.now(); // Start measuring response time

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            res.clearCookie('token');
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (existingUser.status !== 'active') {
            return res.status(403).json({
                message: "Your account is not activated yet. Please contact the admin."
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordMatch) {
            res.clearCookie('token');
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Update login stats
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // "YYYY-MM"

        existingUser.loginStats.totalLogins += 1;
        existingUser.loginStats.currentMonth.count += 1;
        existingUser.loginStats.currentMonth.lastLogin = now;

        // Update monthly history
        const monthIndex = existingUser.loginStats.history.findIndex(
            entry => entry.month === currentMonth
        );

        if (monthIndex >= 0) {
            existingUser.loginStats.history[monthIndex].count += 1;
        } else {
            existingUser.loginStats.history.push({
                month: currentMonth,
                count: 1
            });
        }
        const loginTime = new Date();
        existingUser.lastLoginTime = loginTime;
        // Initialize today's duration if needed
        const today = new Date().toISOString().split('T')[0];
        if (!existingUser.sessionStats.today || existingUser.sessionStats.today.date !== today) {
            existingUser.sessionStats.today = {
                date: today,
                duration: { hours: 0, minutes: 0, seconds: 0 }
            };
        }
        await existingUser.save();
        const secureInfo = sanitizeUser(existingUser);
        const token = generateToken(secureInfo);
        const cookieExpiry = 2 * 60 * 60 * 1000;

        res.cookie('token', token, {
            sameSite: process.env.PRODUCTION ? "none" : 'Lax',
            maxAge: cookieExpiry,
            httpOnly: true,
            secure: process.env.PRODUCTION ? true : false
        });

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Log activity with response time
        const ip = req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress ||
            req.connection.remoteAddress;

        let location = "-";
        try {
            location = await getLocationFromIP(ip);
        } catch (err) {
            console.warn("Could not fetch location info:", err.message);
        }

        try {
            await Activity.create({
                userId: existingUser._id,
                activityType: 'login success',
                description: `${existingUser.email} logged in`,
                ipAddress: ip,
                userAgent: req.headers['user-agent'],
                metadata: {
                    body: { email },
                    query: req.query,
                    params: req.params,
                    responseTime: `${responseTime}ms`
                },
                location
            });
        } catch (logErr) {
            console.error("Activity logging failed:", logErr.message);
        }

        return res.status(200).json({
            user: secureInfo,
            token,
            expiresIn: cookieExpiry,
            message: "Signin successfully",
            responseTime: `${responseTime}ms`
        });

    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({
            message: 'Server busy. Please try again later.'
        });
    }
};

exports.markNotificationAsRead = async (req, res) => {
    try {
        const { userId, notifId } = req.params;

        // Find user and the specific notification
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const notification = user.notifications.id(notifId);
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        // Update "read" field
        notification.read = true;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Get user details by ID (excluding password and createdAt)
exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.findById(userId).select('-password -createdAt -__v');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if the user is a provider - if not, return a message
        if (user.role !== 'provider') {
            return res.status(200).json({
                success: true,
                message: "This user is not a service provider.",
                user: null, // Don't return user data
                services: null // Don't return services
            });
        }

        // Only fetch services if the user is a provider
        const services = await UserServiceRequest.find({ createdBy: user._id }).select('-createdAt -updatedAt');

        res.status(200).json({
            success: true,
            message: "Provider profile fetched successfully.",
            user,
            services
        });
    } catch (error) {
        console.error("Error fetching user details:", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Update user info
exports.updateUser = async (req, res) => {

    try {
        const { id } = req.params;
        let updateData = { ...req.body };
        const { socialLinks } = updateData
        const { instagram, facebook, linkedin, tiktok } = JSON.parse(socialLinks)

        // Handle password update
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        } else {
            delete updateData.password;
        }

        // Handle socialLinks - no need to parse if using proper middleware
        if (updateData.socialLinks && typeof updateData.socialLinks === 'string') {
            try {
                updateData.socialLinks = { instagram, facebook, linkedin, tiktok };
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid socialLinks format"
                });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        ).select('-password'); // Exclude password from the returned user

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email and code are required'
            });
        }

        const user = await User.findOne({
            email,
            resetPasswordCode: code,
            resetCodeExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Code verified successfully'
        });

    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
}

// Send reset code email
exports.sendResetCode = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal if email exists or not
            return res.status(400).json({
                success: true,
                message: 'No account has been registered with this email yet.'
            });
        }

        // Generate reset code
        const resetCode = generateResetCode();
        const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

        // Save to user
        user.resetPasswordCode = resetCode;
        user.resetCodeExpires = resetCodeExpires;
        await user.save();

        try {
            const emailHtml = await createResendOtpTemplate(resetCode);
            await sendMail(
                email,
                'Password Reset Code',
                emailHtml
            );
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }
        res.status(200).json({
            success: true,
            message: 'Reset code sent to email'
        });

    } catch (error) {
        console.error('Send reset code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Reset password with code
exports.resetPasswordWithCode = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email, code, and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await User.findOne({
            email,
            resetPasswordCode: code,
            resetCodeExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code'
            });
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordCode = undefined;
        user.resetCodeExpires = undefined;
        await user.save();

        try {
            const emailHtml = await resetPasswordSuccessfullyTemplate();
            await sendMail(
                email,
                'Password Reset Successful',
                emailHtml
            );
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

exports.forgotPassword = async (req, res) => {
    let newToken;
    try {
        // checks if user provided email exists or not
        const isExistingUser = await User.findOne({ email: req.body.email })

        // if email does not exists returns a 404 response
        if (!isExistingUser) {
            return res.status(404).json({ message: "Provided email does not exists" })
        }

        await PasswordResetToken.deleteMany({ user: isExistingUser._id })

        // if user exists , generates a password reset token
        const passwordResetToken = generateToken(sanitizeUser(isExistingUser), true)

        // hashes the token
        const hashedToken = await bcrypt.hash(passwordResetToken, 10)

        // saves hashed token in passwordResetToken collection
        newToken = new PasswordResetToken({ user: isExistingUser._id, token: hashedToken, expiresAt: Date.now() + parseInt(process.env.OTP_EXPIRATION_TIME) })
        await newToken.save()

        // sends the password reset link to the user's mail
        await sendMail(isExistingUser.email, 'Password Reset Link for Your MERN-AUTH-REDUX-TOOLKIT Account', `<p>Dear ${isExistingUser.name},

        We received a request to reset the password for your MERN-AUTH-REDUX-TOOLKIT account. If you initiated this request, please use the following link to reset your password:</p>
        
        <p><a href=${process.env.ORIGIN}/reset-password/${isExistingUser._id}/${passwordResetToken} target="_blank">Reset Password</a></p>
        
        <p>This link is valid for a limited time. If you did not request a password reset, please ignore this email. Your account security is important to us.
        
        Thank you,
        The MERN-AUTH-REDUX-TOOLKIT Team</p>`)

        res.status(200).json({ message: `Password Reset link sent to ${isExistingUser.email}` })

    } catch (error) {
        res.status(500).json({ message: 'Error occured while sending password reset mail' })
    }
}

exports.resetPassword = async (req, res) => {
    try {

        // checks if user exists or not
        const isExistingUser = await User.findById(req.body.userId)

        // if user does not exists then returns a 404 response
        if (!isExistingUser) {
            return res.status(404).json({ message: "User does not exists" })
        }

        // fetches the resetPassword token by the userId
        const isResetTokenExisting = await PasswordResetToken.findOne({ user: isExistingUser._id })

        // If token does not exists for that userid, then returns a 404 response
        if (!isResetTokenExisting) {
            return res.status(404).json({ message: "Reset Link is Not Valid" })
        }

        // if the token has expired then deletes the token, and send response accordingly
        if (isResetTokenExisting.expiresAt < new Date()) {
            await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id)
            return res.status(404).json({ message: "Reset Link has been expired" })
        }

        // if token exists and is not expired and token matches the hash, then resets the user password and deletes the token
        if (isResetTokenExisting && isResetTokenExisting.expiresAt > new Date() && (await bcrypt.compare(req.body.token, isResetTokenExisting.token))) {

            // deleting the password reset token
            await PasswordResetToken.findByIdAndDelete(isResetTokenExisting._id)

            // resets the password after hashing it
            await User.findByIdAndUpdate(isExistingUser._id, { password: await bcrypt.hash(req.body.password, 10) })
            return res.status(200).json({ message: "Password Updated Successfuly" })
        }

        return res.status(404).json({ message: "Reset Link has been expired" })

    } catch (error) {
        res.status(500).json({ message: "Error occured while resetting the password, please try again later" })
    }
}

exports.logout = async (req, res) => {
    try {
        // Track session duration before logging out
        if (req.user) {
            const user = await User.findById(req.user._id);
            if (user && user.lastLoginTime) {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                const sessionDuration = calculateDuration(user.lastLoginTime, now);

                // Update stats (same as in middleware)
                if (!user.sessionStats.today || user.sessionStats.today.date !== today) {
                    user.sessionStats.today = {
                        date: today,
                        duration: { hours: 0, minutes: 0, seconds: 0 }
                    };
                }
                user.sessionStats.today.duration = addDurations(
                    user.sessionStats.today.duration,
                    sessionDuration
                );

                user.sessionStats.totalDuration = addDurations(
                    user.sessionStats.totalDuration || { hours: 0, minutes: 0, seconds: 0 },
                    sessionDuration
                );

                const existingDayIndex = user.sessionStats.history.findIndex(
                    entry => entry.date === today
                );

                if (existingDayIndex >= 0) {
                    user.sessionStats.history[existingDayIndex].duration = addDurations(
                        user.sessionStats.history[existingDayIndex].duration,
                        sessionDuration
                    );
                } else {
                    user.sessionStats.history.push({
                        date: today,
                        duration: sessionDuration
                    });
                }

                user.lastLoginTime = null;
                await user.save();
            }
        }

        // Clear the token cookie
        res.clearCookie('token', {
            sameSite: process.env.PRODUCTION === 'true' ? "None" : 'Lax',
            httpOnly: true,
            secure: process.env.PRODUCTION === 'true' ? true : false
        });

        return res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error while logging out, please try again later" });
    }
};

exports.checkAuth = async (req, res) => {
    try {
        if (req.user) {
            const user = await User.findById(req.user._id)
            return res.status(200).json(sanitizeUser(user))
        }
        res.sendStatus(401)
    } catch (error) {
        res.sendStatus(500)
    }
}

exports.getOrganizer = async (req, res) => {
    try {
        const { role } = req.params;
        const users = await User.find({ role });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// update avatar
exports.updateAvatar = async (req, res) => {
    try {
        const userId = req.user._id;
        const { avatar } = req.files; // Expecting base64 encoded image or file URL

        if (!avatar) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an image'
            });
        }

        // Check file size (3MB limit)
        if (avatar.size > 3 * 1024 * 1024) { // 3MB in bytes
            return res.status(400).json({
                success: false,
                message: 'File size exceeds the 3MB limit'
            });
        }

        // Get current user data
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let result;
        const uploadOptions = {
            folder: 'avatars',
            width: 192,
            height: 192,
            crop: 'fill'
        };

        // Check image dimensions before uploading
        const imageInfo = await sharp(avatar.tempFilePath).metadata();
        console.log(imageInfo);

        // if (imageInfo.width !== 192 || imageInfo.height !== 192) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Avatar dimensions must be exactly 192x192 pixels'
        //     });
        // }

        // Check if user has existing avatar
        if (user.avatar.public_id && user.avatar.public_id !== 'avatars/pmqlhyz1ehcipviw3ren') {
            // Destroy old image first
            await cloudinary.uploader.destroy(user.avatar.public_id);
            // Upload new image
            result = await cloudinary.uploader.upload(avatar.tempFilePath, uploadOptions);
        } else {
            // Upload new image without destroying default
            result = await cloudinary.uploader.upload(avatar.tempFilePath, uploadOptions);
        }

        // Update user avatar
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    'avatar.public_id': result.public_id,
                    'avatar.url': result.secure_url
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            message: 'Avatar updated successfully',
        });

    } catch (error) {
        console.error('Error updating avatar:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update avatar',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// update cover
exports.updateCover = async (req, res) => {
    try {
        const userId = req.user._id;
        const { cover } = req.files; // Expecting base64 encoded image or file URL

        if (!cover) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an image'
            });
        }

        // Check file size (3MB limit)
        if (cover.size > 3 * 1024 * 1024) { // 3MB in bytes
            return res.status(400).json({
                success: false,
                message: 'File size exceeds the 3MB limit'
            });
        }

        // Get current user data
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let result;
        const uploadOptions = {
            folder: 'covers',
            width: 1200,
            height: 595,
            crop: 'fill'
        };

        // Check image dimensions before uploading
        const imageInfo = await sharp(cover.tempFilePath).metadata();
        if (imageInfo.width !== 1200 || imageInfo.height !== 595) {
            return res.status(400).json({
                success: false,
                message: 'Image dimensions must be exactly 1200x595 pixels'
            });
        }

        // Check if user has existing cover
        if (user.cover.public_id && user.cover.public_id !== 'cover/profile-cover') {
            // Destroy old image first
            await cloudinary.uploader.destroy(user.cover.public_id);
            // Upload new image
            result = await cloudinary.uploader.upload(cover.tempFilePath, uploadOptions);
        } else {
            // Upload new image without destroying default
            result = await cloudinary.uploader.upload(cover.tempFilePath, uploadOptions);
        }

        // Update user cover
        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    'cover.public_id': result.public_id,
                    'cover.url': result.secure_url
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            message: 'Cover image updated successfully',
        });

    } catch (error) {
        console.error('Error updating cover image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update cover image' || error.message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// --------------------------------Review System-----------------------------------
exports.createReview = async (req, res) => {
    try {
        const { reviewedUserId, rating, comment } = req.body;
        const userId = req.user._id;

        // Check if user already reviewed this provider
        const existingReview = await Review.findOne({
            user: userId,
            reviewedUserId: reviewedUserId
        });

        if (existingReview) {
            return res.status(400).json({
                message: "You have already reviewed this provider"
            });
        }

        const newReview = new Review({
            user: userId,
            reviewedUserId,
            rating,
            comment
        });

        await newReview.save();

        // Update provider's average rating
        const provider = await User.findById(reviewedUserId);
        if (!provider) {
            return res.status(404).json({
                message: "Provider not found"
            });
        }

        // Force the update and wait for it to complete
        await provider.updateAverageRating();

        // Fetch the updated provider to verify changes
        const updatedProvider = await User.findById(reviewedUserId);

        res.status(201).json({
            success: true,
            review: newReview,
            providerStats: {
                averageRating: updatedProvider.averageRating,
                reviewCount: updatedProvider.reviewCount
            }
        });
    } catch (error) {
        console.error("Error creating review:", error);
        res.status(500).json({
            message: error.message
        });
    }
};

exports.addReply = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { replyText } = req.body;
        const providerId = req.user._id;

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Check if the user replying is the provider being reviewed
        if (review.reviewedUserId.toString() !== providerId.toString()) {
            return res.status(403).json({ message: "Unauthorized to reply to this review" });
        }

        review.reply = {
            text: replyText,
            repliedBy: providerId,
            createdAt: new Date()
        };

        await review.save();
        res.status(200).json({
            success: true,
            review
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProviderReviews = async (req, res) => {
    try {
        const providerId = req.user._id;

        // Get all reviews for the provider
        const reviews = await Review.find({ reviewedUserId: providerId })
            .populate("user", "name avatar")
            .populate("reply.repliedBy", "name avatar")
            .sort({ createdAt: -1 });

        // Calculate rating statistics
        const ratingCounts = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
        };

        let totalRating = 0;

        reviews.forEach(review => {
            ratingCounts[review.rating]++;
            totalRating += review.rating;
        });

        const averageRating = reviews.length > 0
            ? (totalRating / reviews.length).toFixed(1)
            : 0;

        res.status(200).json({
            success: true,
            reviews,
            ratingStatistics: {
                averageRating: parseFloat(averageRating),
                totalReviews: reviews.length,
                ratingCounts,
                ratingDistribution: {
                    '1-star': ratingCounts[1],
                    '2-star': ratingCounts[2],
                    '3-star': ratingCounts[3],
                    '4-star': ratingCounts[4],
                    '5-star': ratingCounts[5]
                }
            }
        });
    } catch (error) {
        console.error("Error fetching provider reviews:", error);
        res.status(500).json({
            message: error.message
        });
    }
};