const adminPaymentHistory = require("../../../models/admin-payment/payment-history");


exports.getAllAdminTransactions = async (req, res) => {
    try {
        const adminId = req.user._id;

        // Extract query parameters for filtering, sorting, and pagination
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
            startDate,
            endDate,
            search
        } = req.query;

        // Build filter object
        const filter = {};

        // Add status filter if provided
        if (status && status !== 'all') {
            filter.status = status;
        }

        // Add date range filter if provided
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.createdAt.$lte = new Date(endDate);
            }
        }

        // Add search filter for transaction ID
        if (search) {
            filter.transId = { $regex: search, $options: 'i' };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Sort configuration
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Fetch payment history with population
        const payments = await adminPaymentHistory
            .find(filter)
            .populate('eventId', 'eventName eventDate')
            .populate('organizerId', 'name email')
            .populate('eventReqId', 'proposedBudget')
            .populate('placeABidId', 'bidAmount')
            .populate('bidId', 'amount')
            .sort(sortConfig)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get total count for pagination
        const totalCount = await adminPaymentHistory.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Payment history fetched successfully',
            payments,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (err) {
        console.error('Error fetching admin transactions:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching payment history'
        });
    }
};
