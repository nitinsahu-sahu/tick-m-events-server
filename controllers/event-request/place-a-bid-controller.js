const PlaceABidModal = require("../../models/event-request/placeBid.modal");
const Bid = require("../../models/event-request/bid.modal");
const Category = require("../../models/event-details/Category");
const Verification = require("../../models/profile-service-maagement/Verification");
const mongoose = require("mongoose")

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

    // Get verification data for the createdBy user
    let verificationData = null;
    if (project.createdBy) {
      verificationData = await Verification.findOne({
        userId: project.createdBy._id
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
      ...project.toObject(),
      subcategoryName: subcategoryName,
      createdBy: {
        ...project.createdBy.toObject(),
        verification: verificationData ? {
          emailVerified: verificationData.emailVerified,
          whatsappVerified: verificationData.whatsappVerified,
          identityVerified: verificationData.identityVerified,
          paymentVerified: verificationData.paymentVerified,
          overallVerified: verificationData.emailVerified &&
            verificationData.whatsappVerified &&
            verificationData.identityVerified &&
            verificationData.paymentVerified
        } : null
      }
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

exports.placeBid = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { projectId } = req.params;
    const {
      bidAmount,
      deliveryTime,
      deliveryUnit,
      proposal,
      milestones
    } = req.body;

    const providerId = req.user._id;

    // Validate project exists and is open for bidding
    const project = await PlaceABidModal.findById(projectId);
    if (!project) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.status !== 'open') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Project is not open for bidding'
      });
    }

    // Check if user has already placed a bid on this project
    const existingBid = await Bid.findOne({
      projectId,
      providerId
    });

    if (existingBid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You have already placed a bid on this project'
      });
    }

    // Validate proposal length
    if (proposal.length < 100) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Proposal must be at least 100 characters long'
      });
    }

    // Validate milestones
    if (milestones && milestones.length > 0) {
      for (let milestone of milestones) {
        if (!milestone.milestorneName || !milestone.amount) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'All milestones must have a milestornename and amount'
          });
        }

        if (isNaN(milestone.amount) || milestone.amount <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'Milestone amount must be a positive number'
          });
        }
      }
    }

    // Create the bid
    const bid = await Bid.create([{
      projectId,
      providerId,
      bidAmount,
      deliveryTime,
      deliveryUnit,
      proposal,
      milestones: milestones || []
    }], { session });

    // Update project bid count
    await PlaceABidModal.findByIdAndUpdate(
      projectId,
      {
        $inc: {
          bidsCount: 1,
          totalBidAmount: bidAmount
        }
      },
      { session }
    );

    // Then calculate and update the average
    await PlaceABidModal.findByIdAndUpdate(
      projectId,
      [
        {
          $set: {
            avgBidAmount: {
              $cond: {
                if: { $gt: ["$bidsCount", 0] },
                then: { $divide: ["$totalBidAmount", "$bidsCount"] },
                else: 0
              }
            }
          }
        }
      ],
      { session }
    );
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Bid placed successfully',
      data: bid[0]
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error placing bid:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all bids for a project
// @route   GET /api/projects/:projectId/bids
// @access  Private (Project owner only)
exports.getProjectBids = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    // Check if projectId is provided and valid
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid project ID is required'
      });
    }

    // Verify project exists and user owns it
    const project = await PlaceABidModal.findById(projectId); // Use your actual Project model
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if user owns the project or is admin
    if (project.createdBy.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view bids for this project'
      });
    }

    const bids = await Bid.find({ projectId })
      .populate('providerId', 'name profilePicture rating reviewCount') // Fixed field name
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bids.length,
      data: bids
    });

  } catch (error) {
    console.error('Error fetching bids:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get user's bids
// @route   GET /api/bids/my-bids
// @access  Private
exports.getMyBids = async (req, res, next) => {
  try {
    const providerId = req.user._id;

    const bids = await Bid.find({ providerId })
      .populate('projectId', 'title description budget')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bids.length,
      data: bids
    });

  } catch (error) {
    console.error('Error fetching user bids:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get user's bids
// @route   GET /api/bids/my-bids
// @access  Private
exports.getMyBidByProject = async (req, res, next) => {
  try {
    const providerId = req.user._id;
    const { projectId } = req.params;

    // Check if projectId is provided and valid
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid project ID is required'
      });
    }

    // Verify project exists
    const project = await PlaceABidModal.findById(projectId); // Use your actual Project model
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if provider has bid on this project
    const hasBid = await Bid.exists({
      projectId: projectId,
      providerId: providerId
    });
    const bid = await Bid.findOne({  projectId: projectId,
      providerId: providerId })
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      bid,
      hasBid: !!hasBid, // Convert to boolean
      message: hasBid ? 'You have placed a bid on this project' : 'You have not bid on this project yet'
    });

  } catch (error) {
    console.error('Error fetching user bid:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update a bid
// @route   PUT /api/bids/:bidId
// @access  Private (Bid owner only)
exports.updateBid = async (req, res, next) => {
  try {
    const { bidId } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    // Find the bid
    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.freelancerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this bid'
      });
    }

    // Check if bid can still be updated
    const project = await PlaceABidModal.findById(bid.projectId);
    if (project.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update bid as project is no longer active'
      });
    }

    // Validate proposal length if being updated
    if (updateData.proposal && updateData.proposal.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Proposal must be at least 100 characters long'
      });
    }

    const updatedBid = await Bid.findByIdAndUpdate(
      bidId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Bid updated successfully',
      data: updatedBid
    });

  } catch (error) {
    console.error('Error updating bid:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Withdraw a bid
// @route   DELETE /api/bids/:bidId
// @access  Private (Bid owner only)
exports.withdrawBid = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bidId } = req.params;
    const userId = req.user._id;

    // Find the bid
    const bid = await Bid.findById(bidId).session(session);
    if (!bid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.freelancerId.toString() !== userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to withdraw this bid'
      });
    }

    // Check if bid can be withdrawn
    if (bid.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Only pending bids can be withdrawn'
      });
    }

    // Update bid status
    bid.status = 'withdrawn';
    await bid.save({ session });

    // Decrement project bid count
    await Project.findByIdAndUpdate(
      bid.projectId,
      { $inc: { bidCount: -1 } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Bid withdrawn successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error withdrawing bid:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};