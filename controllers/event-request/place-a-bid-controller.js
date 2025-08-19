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
                { path: 'eventId', select: 'date location eventName averageRating' },
                { path: 'categoryId', select: 'name' },
                { path: 'createdBy', select: '-serviceCategory -cover -loginStats -profileViews -sessionStats -role -socketId -__v -password -isAdmin -updatedAt -experience -website' }
            ])
            .sort(sort)
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // Get all unique subcategory IDs
        const subcategoryIds = [...new Set(projects.map(p => p.subcategoryId))];

        // Find all matching subcategories in one query
        const categoriesWithSubcategories = await Category.find({
            'subcategories._id': { $in: subcategoryIds }
        }, {
            'subcategories.$': 1
        });

        // Create a map of subcategory IDs to names
        const subcategoryMap = {};
        categoriesWithSubcategories.forEach(cat => {
            cat.subcategories.forEach(subcat => {
                subcategoryMap[subcat._id.toString()] = subcat.name;
            });
        });

        // Add subcategory names to projects
        const projectsWithSubcategoryNames = projects.map(project => ({
            ...project,
            subcategoryName: subcategoryMap[project.subcategoryId.toString()] || null
        }));

        // Count total documents for pagination info
        const total = await PlaceABidModal.countDocuments(query);

        res.status(200).json({
            success: true,
            count: projectsWithSubcategoryNames.length,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page,
            projects: projectsWithSubcategoryNames
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
        const project = await PlaceABidModal.findById(req.params.projectId)
            .populate([
                { path: 'eventId', select: 'date location eventName averageRating' },
                { path: 'categoryId', select: 'name' },
                { path: 'createdBy', select: '-serviceCategory -cover -loginStats -profileViews -sessionStats -role -socketId -__v -password -isAdmin -updatedAt -experience -website' }
            ]);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }

        // Since it's a single project, get its subcategory ID
        const subcategoryId = project.subcategoryId;

        // Find the category that contains this subcategory
        const categoryWithSubcategory = await Category.findOne({
            'subcategories._id': subcategoryId
        }, {
            'subcategories.$': 1
        });

        // Get the subcategory name
        let subcategoryName = null;
        if (categoryWithSubcategory && categoryWithSubcategory.subcategories.length > 0) {
            subcategoryName = categoryWithSubcategory.subcategories[0].name;
        }

        // Add subcategory name to the project object
        const projectWithSubcategory = {
            ...project.toObject(), // Convert mongoose document to plain object
            subcategoryName: subcategoryName
        };

        res.status(200).json({
            message: "Fetched successfully...",
            success: true,
            project: projectWithSubcategory
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