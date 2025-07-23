const User = require('../../models/User');
const ServiceRequest = require('../../models/service-reequest/service-request');
const Review = require('../../models/userReview/Review');


// Get specific fields of all service providers
// exports.getAllServiceProvider = async (req, res) => {
//     try {
//         // Extract query parameters
//         const { search, certified, rating, location, serviceCategory } = req.query;

//         // Build the filter object
//         const filter = { role: 'provider' };

//         // Add search filter
//         if (search) {
//             filter.$or = [
//                 { name: { $regex: search, $options: 'i' } },
//                 { username: { $regex: search, $options: 'i' } }
//             ];
//         }

//         // Add certified filter
//         if (certified === 'true') {
//             filter.certified = true;
//         }

//         // Add minimum rating filter
//         if (rating && parseFloat(rating) > 0) {
//             filter.averageRating = { $gte: parseFloat(rating) };
//         }

//         // Add location filter
//         if (location) {
//             filter.address = { $regex: location, $options: 'i' };
//         }

//         // Improved service category filter
//         if (serviceCategory) {
//             // Clean the serviceCategory string
//             const cleanedCategory = serviceCategory.trim();

//             // Use regex for partial/flexible matching
//             filter.serviceCategory = {
//                 $regex: new RegExp(cleanedCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
//             };

//             // Alternative for exact match (if you store categories consistently):
//             // filter.serviceCategory = cleanedCategory;
//         }

//         // Execute the query with filters
//         const providersDAta = await User.find(filter).select("-password -__v -updatedAt -createdAt");
//         // Get services for all providers
//         const providers = await Promise.all(
//             providersDAta.map(async (provider) => {
//                 const services = await ServiceRequest.find({
//                     createdBy: provider._id,
//                     status: 'active'
//                 }).select('serviceType eventLocation dateAndTime budget description status');

//                 return {
//                     ...provider.toObject(),
//                     services
//                 };
//             })
//         );
//         res.status(200).json(providers);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };
exports.getAllServiceProvider = async (req, res) => {
    try {
        // Extract query parameters
        const { search, certified, rating, location, serviceCategory } = req.query;

        // Build the filter object
        const filter = { role: 'provider' };

        // Add search filter
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

        // Add location filter
        if (location) {
            filter.address = { $regex: location, $options: 'i' };
        }

        // Improved service category filter
        if (serviceCategory) {
            const cleanedCategory = serviceCategory.trim();
            filter.serviceCategory = {
                $regex: new RegExp(cleanedCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            };
        }

        // Execute the query with filters
        const providersData = await User.find(filter).select("-password -__v -updatedAt -createdAt");
        
        // Get services and reviews for all providers
        const providers = await Promise.all(
            providersData.map(async (provider) => {
                const [services, reviews] = await Promise.all([
                    ServiceRequest.find({
                        createdBy: provider._id,
                        status: 'active'
                    }).select('serviceType images eventLocation dateAndTime budget description status'),
                    
                    Review.find({
                        reviewedUserId: provider._id
                    })
                    .populate('user', 'name avatar') // Include reviewer's name and avatar
                    .populate('reply.repliedBy', 'name') // Include replier's name if there's a reply
                    .sort({ createdAt: -1 }) // Sort by newest first
                ]);

                return {
                    ...provider.toObject(),
                    services,
                    reviews
                };
            })
        );

        res.status(200).json(providers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllServiceCategories = async (req, res) => {
    try {
        // Option 1: If categories are stored in User model
        const usersWithServices = await User.find(
            { role: 'provider', serviceCategory: { $exists: true, $ne: null } },
            { serviceCategory: 1, _id: 0 }
        );

        // Extract unique categories
        const categories = [...new Set(
            usersWithServices
                .map(user => user.serviceCategory)
                .filter(cat => cat) // Remove null/undefined
        )];

        // Option 2: If using a dedicated ServiceCategory model
        // const categories = await ServiceCategory.find().sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            categories
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};