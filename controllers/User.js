const User = require("../models/User")

exports.getById = async (req, res) => {
    try {
        const { id } = req.params
        const result = (await User.findById(id)).toObject()
        delete result.password
        res.status(200).json(result)

    } catch (error) {
        console.log(error);
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
        console.log(error);
        res.status(500).json({ message: 'Error getting your details, please try again later' })
    }
}