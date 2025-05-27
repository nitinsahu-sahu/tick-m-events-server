const User = require('../../models/User');

// Get specific fields of all service providers
exports.getAllServiceProvider = async (req, res) => {
    try {
        const providers = await User.find(
            { role: 'provider' },  // Filter by role
            { 
                _id: 1,           // Include _id
                name: 1,           // Include name
                averageRating: 1,  // Include averageRating
                serviceCategory: 1, // Include serviceCategory
                address: 1         // Include address
            }
        );
        res.status(200).json(providers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};