const User = require('../../models/User');

// Get All Service Requests
exports.getAllServiceProvider = async (req, res) => {
    try {
        const requests = await User.find().populate('createdBy');
        res.status(200).json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};