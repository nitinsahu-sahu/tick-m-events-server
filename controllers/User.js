const User = require("../models/User")
const mongoose = require("mongoose")

exports.getById = async (req, res) => {
    try {
        const { id } = req.params
        const result = (await User.findById(id)).toObject()
        delete result.password
        res.status(200).json(result)

    } catch (error) {
        res.status(500).json({ message: 'Error getting your details, please try again later' })
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        // Extract pagination parameters from query
        const page = parseInt(req.query.page) || 1; // Default page is 1
        const limit = parseInt(req.query.limit) || 10; // Default limit is 10

        // Extract filter parameters from query
        const { isVerified, role, status, _id } = req.query;
        // Fetch the logged-in user's details
        const loggedInUser = await User.findById(_id);
        // Build the filter object
        const filter = {};

        if (isVerified !== undefined && isVerified !== 'all') {
            filter.isVerified = isVerified === 'true'; // Convert string to boolean
        }

        if (role && role !== 'all') {
            filter.role = role; // Filter by role (e.g., ADMIN, SUPERADMIN, GUEST)
        }

        if (status && status !== 'all') {
            filter.status = status;
        }

        // Role-based filtering logic
        if (loggedInUser.role === "admin") {
            // Admins see all users except themselves
            filter._id = { $ne: _id };
        } else if (loggedInUser.role === "vendor") {
            // Vendors see only Guest users
            filter.role = "guest";
        } else {
            // Other users only see their own profile
            filter._id = _id;
        }

        // Calculate skip value
        const skip = (page - 1) * limit;

        // Fetch total number of users (for pagination metadata)
        const totalUsers = await User.countDocuments(filter);

        // Fetch paginated users with filters applied
        const users = await User.find(filter)
            .skip(skip)
            .limit(limit)
            .select('-password'); // Exclude sensitive fields like password

        // Calculate total pages
        const totalPages = Math.ceil(totalUsers / limit);

        // Return response with paginated users and metadata
        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: page,
                usersPerPage: limit,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching users',
        });
    }
};

exports.updateById = async (req, res) => {
    try {
        const { id } = req.params
        const updated = (await User.findByIdAndUpdate(id, req.body, { new: true })).toObject()
        delete updated.password
        res.status(200).json(updated)

    } catch (error) {
        res.status(500).json({ message: 'Error getting your details, please try again later' })
    }
}

exports.profileViewsCount = async (req, res) => {
    try {
        const { userId } = req.params; // Get userId from URL params
        const viewerId = req.user?._id; // Assuming you have authenticated user info

        // Validate userId
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Find the user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get current date info for monthly tracking
        const currentDate = new Date();
        const currentMonth = currentDate.toISOString().slice(0, 7); // "YYYY-MM"

        // Initialize profileViews if it doesn't exist
        if (!user.profileViews) {
            user.profileViews = {
                currentMonth: {
                    count: 0,
                    viewers: []
                },
                history: []
            };
        }

        // Initialize currentMonth if it doesn't exist
        if (!user.profileViews.currentMonth) {
            user.profileViews.currentMonth = {
                count: 0,
                viewers: []
            };
        }

        // Check if we need to reset monthly stats (new month)
        const lastViewMonth = user.profileViews.currentMonth.lastReset || currentMonth;
        if (lastViewMonth !== currentMonth) {
            // Move current month to history
            if (user.profileViews.currentMonth.count > 0) {
                user.profileViews.history.push({
                    month: lastViewMonth,
                    count: user.profileViews.currentMonth.count
                });
            }

            // Reset current month
            user.profileViews.currentMonth = {
                count: 0,
                viewers: [],
                lastReset: currentMonth
            };
        }

        let isNewView = false;

        // Check if viewer is provided and not already viewed this month
        if (viewerId && mongoose.Types.ObjectId.isValid(viewerId)) {
            const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
            
            // Check if this viewer already viewed this month
            const alreadyViewed = user.profileViews.currentMonth.viewers.some(
                viewer => viewer.equals(viewerObjectId)
            );

            if (!alreadyViewed) {
                // Add viewer to the list
                user.profileViews.currentMonth.viewers.push(viewerObjectId);
                
                // Increment count
                user.profileViews.currentMonth.count += 1;
                isNewView = true;
            }
        } else {
            // If no viewer ID provided, just increment count
            user.profileViews.currentMonth.count += 1;
            isNewView = true;
        }

        // Ensure history exists
        if (!user.profileViews.history) {
            user.profileViews.history = [];
        }

        // Save the updated user
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile views updated successfully',
            data: {
                profileViews: user.profileViews.currentMonth.count,
                totalUniqueViewers: user.profileViews.currentMonth.viewers.length,
                isNewView: isNewView,
                currentMonth: currentMonth
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Error getting your details, please try again later' })
    }
}