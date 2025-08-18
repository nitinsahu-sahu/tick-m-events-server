const PlaceABidModal = require("../../models/event-request/placeBid.modal");
const Category = require("../../models/event-details/Category");

// Organizer Place a Custome Service For Event
exports.postPlaceABid = async (req, res) => {
    try {
        const { serviceTime, status, eventId, serviceCategoryId, orgRequirement,
            orgBudget, eventLocation, orgAdditionalRequirement } = req.body;
        const createdBy = req.user._id;
        // First find the parent category that contains this subcategory
        const parentCategory = await Category.findOne({
            'subcategories._id': serviceCategoryId
        });
        if (!parentCategory) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subcategory ID'
            });
        }

        const request = await PlaceABidModal.create({
            eventId,
            categoryId: parentCategory._id, // Store parent category ID
            subcategoryId: serviceCategoryId, // Optionally store subcategory ID too
            status,
            orgRequirement,
            orgBudget,
            eventLocation,
            orgAdditionalRequirement,
            serviceTime,
            createdBy
        });

        res.status(201).json({
            success: true,
            request,
            message: "Request sent successfully!"
        });

    } catch (err) {
        console.error('Error creating request:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create service request',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getBids = async (req, res) => {
    try {
        // Extract query parameters
        const {
            eventId,
            createdBy,
            status,
            minBudget,
            maxBudget,
            hasProposal,
            sortBy,
            limit = 10,
            page = 1
        } = req.query;

        // Build query object
        const query = {};

        if (eventId) query.eventId = eventId;
        if (createdBy) query.createdBy = createdBy;
        if (status) query.status = status;
        if (hasProposal) query.providerHasProposed = hasProposal === 'true';

        // Budget range filtering
        if (minBudget || maxBudget) {
            query.orgBudget = {};
            if (minBudget) query.orgBudget.$gte = Number(minBudget);
            if (maxBudget) query.orgBudget.$lte = Number(maxBudget);
        }

        // Build sort object
        const sort = {};
        if (sortBy) {
            const parts = sortBy.split(':');
            sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1; // Default: newest first
        }

        // Pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Get bids with pagination
        const projects = await PlaceABidModal.find(query)
            .populate([
                { path: 'eventId', select: 'date location eventName' },
                { path: 'categoryId', select: 'name' },
                { path: 'createdBy', select: 'name email profile' }
            ])
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        // Count total documents for pagination info
        const total = await PlaceABidModal.countDocuments(query);

        res.status(200).json({
            success: true,
            count: projects.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page,
            projects
        });

    } catch (err) {
        console.error('Error fetching bids:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bids',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

exports.getBidById = async (req, res) => {
    try {
        const bid = await PlaceABidModal.findById(req.params.id)
            .populate([
                { path: 'eventId', select: 'title date location organizer' },
                { path: 'serviceCategoryId', select: 'name description' },
                { path: 'createdBy', select: 'name email profile phone' }
            ]);

        if (!bid) {
            return res.status(404).json({
                success: false,
                message: 'Bid not found'
            });
        }

        res.status(200).json({
            success: true,
            data: bid
        });

    } catch (err) {
        console.error('Error fetching bid:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bid',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};