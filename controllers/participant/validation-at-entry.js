const User =require('../../models/User');
const mongoose = require("mongoose");

exports.getOrderasPerEvent = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        // 1. Get all orders for the user
        const orders = await EventOrder.find({ userId }).sort({ createdAt: -1 });

        // 2. Extract all unique eventIds
        const eventIds = [...new Set(orders.map(order => order.eventId))];

        // 3. Fetch corresponding events
        const events = await Event.find({ _id: { $in: eventIds } });
        const eventMap = {};
        events.forEach(event => {
            eventMap[event._id.toString()] = event;
        });

        // 5. Enrich each order
        const enrichedOrders = orders.map(order => {
            const event = eventMap[order.eventId] || null;
           
            return {
                ...order.toObject(),
                eventDetails: event,
              
            };
        }).sort((a, b) => {
            if (!a.eventDate) return 1;
            if (!b.eventDate) return -1;
            return a.eventDate - b.eventDate;
        });
        res.status(200).json(enrichedOrders);
    } catch (error) {
        console.error("Error in getOrdersByUser:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

exports.getParticipantProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user profile with populated data
        const userProfile = await User.findById(userId)
            .select('-notifications -sessionStats -isAdmin -reviewCount -serviceCategory -updatedAt -__v -website -profileViews -loginStats -lastLoginTime -averageRating -experience -password -resetPasswordToken -resetPasswordExpires -resetPasswordCode -resetCodeExpires -gigsCounts')
            .populate('referredBy', 'name username __id')
            .lean();

        if (!userProfile) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile retrieved successfully",
            userProfile
        });

    } catch (error) {
        console.error("Error in getParticipantProfile:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
}

exports.updateParticipantProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;

        // List of allowed fields that can be updated
        const allowedFields = [
            'name', 
            'username', 
            'email', 
            'gender', 
            'number', 
            'address',
            'avatar',
            'cover'
        ];

        // Filter update data to only include allowed fields
        const filteredUpdateData = {};
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                filteredUpdateData[key] = updateData[key];
            }
        });

        // Check if user exists
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // Check if email is being updated and if it's already taken by another user
        if (filteredUpdateData.email && filteredUpdateData.email !== existingUser.email) {
            const emailExists = await User.findOne({ 
                email: filteredUpdateData.email, 
                _id: { $ne: userId } 
            });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "Email is already taken by another user"
                });
            }
        }

        // Check if username is being updated and if it's already taken by another user
        if (filteredUpdateData.username && filteredUpdateData.username !== existingUser.username) {
            const usernameExists = await User.findOne({ 
                username: filteredUpdateData.username, 
                _id: { $ne: userId } 
            });
            if (usernameExists) {
                return res.status(400).json({
                    success: false,
                    message: "Username is already taken by another user"
                });
            }
        }

        // Update the user profile
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: filteredUpdateData },
            { 
                new: true, // Return updated document
                runValidators: true // Run model validations
            }
        )
        .select('-notifications -sessionStats -isAdmin -reviewCount -serviceCategory -updatedAt -__v -website -profileViews -loginStats -lastLoginTime -averageRating -experience -password -resetPasswordToken -resetPasswordExpires -resetPasswordCode -resetCodeExpires -gigsCounts')
        .populate('referredBy', 'name username __id')
        .lean();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            userProfile: updatedUser
        });

    } catch (error) {
        console.error("Error in updateParticipantProfile:", error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: errors
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                success: false,
                message: `${field} already exists`
            });
        }

        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
}