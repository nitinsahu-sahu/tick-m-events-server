const User = require('../../models/User');

// Get specific fields of all service providers
exports.getAllServiceProvider = async (req, res) => {
    try {
        // Extract query parameters
        const { search, certified, rating, location, serviceCategory } = req.query;
       console.log('===========response=========data================');
    console.log(req.query);
    console.log('====================================');
        // Build the filter object
        const filter = { role: 'provider' };

        // Add search filter (case-insensitive regex for name or username)
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        // Add certified filter
       if (certified === 'true') {
            filter.certified = true;
        }

        // Add minimum rating filter
        if (rating && parseFloat(rating) > 0) {
            filter.averageRating = { $gte: parseFloat(rating) };
        }

        // Add location filter (case-insensitive regex)
        if (location) {
            filter.address = { $regex: location, $options: 'i' };
        }

        // Add service category filter (assuming you have a serviceCategory field)
        if (serviceCategory) {
            filter.serviceCategory = serviceCategory;
        }

        // Execute the query with filters
        const providers = await User.find(filter);

        res.status(200).json(providers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};