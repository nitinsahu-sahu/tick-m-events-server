const Event = require('../../models/event-details/Event');
const User = require('../../models/User');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Ticket = require('../../models/event-details/Ticket');
const TicketType = require('../../models/TicketType');
const Visibility = require('../../models/event-details/Visibility');
const eventReview = require('../../models/event-details/eventReview');
const Category = require('../../models/event-details/Category');
const EventOrders = require('../../models/event-order/EventOrder');
const CustomPhotoFrame = require('../../models/event-details/CustomPhotoFrame');
const TicketConfiguration = require('../../models/event-details/Ticket');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const EventsRequest = require('../../models/event-request/event-requests.model');
const mongoose = require("mongoose")
const PlaceABid = require('../../models/event-request/placeBid.modal');
const Bid = require('../../models/event-request/bid.modal');
const { createBidStatusEmailTemplate } = require('../../utils/Emails-template');
const { sendMail } = require('../../utils/Emails');
const Withdrawal = require('../../models/transaction-&-payment/Withdrawal');

exports.updateBidStatus = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bidId } = req.params;
        const { status, rejectionReason, bidData, milestones } = req.body.data;
        const acceptedAmount = Number(bidData.bidAmount);

        // Validate input
        if (!bidId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Bid ID is required',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(bidId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid Bid ID format',
            });
        }

        // Validate status
        if (!status || !['isOrgnizerAccepted', 'rejected'].includes(status)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Valid status (accepted or rejected) is required',
            });
        }
        // isOrgnizerAccepted
        // Find the bid
        const bid = await Bid.findById(bidId).session(session);
        if (!bid) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Bid not found',
            });
        }

        // Check if bid is already decided
        if (bid.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Bid has already been ${bid.status}`,
            });
        }

        // Prepare update object
        const updateData = {};
        // Add validation based on status

        if (status === 'rejected') {
            if (!rejectionReason || rejectionReason.trim().length < 10) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Rejection reason is required and must be at least 10 characters long',
                });
            }
            updateData.rejectionReason = rejectionReason;
        }

        if (status === 'isOrgnizerAccepted') {
            if (!acceptedAmount || isNaN(acceptedAmount) || acceptedAmount <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Valid accepted amount is required',
                });
            }

            // updateData.winningBid = acceptedAmount;
            updateData.organizrAmount = acceptedAmount;
            updateData.isOrgnizerAccepted = true;

            // Update bid data if provided
            if (bidData) {
                if (bidData.deliveryTime) updateData.deliveryTime = Number(bidData.deliveryTime);
                if (bidData.deliveryUnit) updateData.deliveryUnit = bidData.deliveryUnit;
                if (bidData.proposal) updateData.proposal = bidData.proposal;
            }

            // Process milestones if provided
            if (milestones && Array.isArray(milestones)) {
                const updatedMilestones = [];

                for (const milestoneData of milestones) {
                    // Convert amount to number
                    const amount = Number(milestoneData.amount);

                    if (isNaN(amount) || amount <= 0) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(400).json({
                            success: false,
                            message: `Invalid amount for milestone: ${milestoneData.milestorneName}`
                        });
                    }

                    // Check if milestone has _id (existing milestone)
                    if (milestoneData._id && mongoose.Types.ObjectId.isValid(milestoneData._id)) {
                        // Find and update existing milestone
                        const existingMilestoneIndex = bid.milestones.findIndex(
                            m => m._id.toString() === milestoneData._id
                        );

                        if (existingMilestoneIndex !== -1) {
                            // Update existing milestone
                            bid.milestones[existingMilestoneIndex].milestorneName = milestoneData.milestorneName;
                            bid.milestones[existingMilestoneIndex].amount = amount;
                            bid.milestones[existingMilestoneIndex].currency = milestoneData.currency || 'XAF';
                            bid.milestones[existingMilestoneIndex].isReleased = milestoneData.isReleased || false;
                            updatedMilestones.push(bid.milestones[existingMilestoneIndex]);
                        } else {
                            // Add as new milestone (shouldn't normally happen)
                            updatedMilestones.push({
                                milestorneName: milestoneData.milestorneName,
                                amount: amount,
                                currency: milestoneData.currency || 'XAF',
                                isReleased: milestoneData.isReleased || false
                            });
                        }
                    } else {
                        // Add new milestone
                        updatedMilestones.push({
                            milestorneName: milestoneData.milestorneName,
                            amount: amount,
                            currency: milestoneData.currency || 'XAF',
                            isReleased: milestoneData.isReleased || false

                        });
                    }
                }

                // Replace the milestones array
                updateData.milestones = updatedMilestones;
            }
        }

        // Update the bid
        const updatedBid = await Bid.findByIdAndUpdate(
            bidId,
            updateData,
            { new: true, runValidators: true, session }
        ).populate('providerId', 'name email');

        // If bid is accepted, update the project to mark it as closed
        if (status === 'accepted') {
            const placeProject = await PlaceABid.findByIdAndUpdate(
                bid.projectId,
                {
                    bidStatus: 'closed',
                    isSigned: true
                },
                { new: true, session }
            )
                .populate('eventId')
                .populate('categoryId')
                .populate('createdBy');

            // Reject all other bids for this project
            await Bid.updateMany(
                {
                    projectId: bid.projectId,
                    _id: { $ne: bidId },
                    status: 'pending'
                },
                {
                    status: 'rejected',
                    rejectionReason: 'Another bid was accepted for this project',
                },
                { session }
            );

            // Get the updated bids count and other statistics if needed
            const updatedBids = await Bid.findOne({
                projectId: placeProject._id,
                status: "accepted"
            }).populate('providerId').session(session);

            const projectDetails = {
                eventName: placeProject.eventId.eventName,
                eventDate: placeProject.eventId.date,
                eventTime: placeProject.eventId.time,
                catName: placeProject.categoryId.name,
                eventLocation: placeProject.eventLocation,
                req: placeProject.orgRequirement,
                isSigned: placeProject.isSigned,
                orgName: placeProject.createdBy.name,
                orgEmail: placeProject.createdBy.email,
            };

            const bidDetails = {
                providerName: updatedBids.providerId.name,
                providerEmail: updatedBids.providerId.email,
                bidAmt: updatedBids.bidAmount,
                deliveryTime: updatedBids.deliveryTime,
                proposal: updatedBids.proposal,
                deliveryUnit: updatedBids.deliveryUnit,
                milestones: updatedBids.milestones,
                status: updatedBids.status,
                winningBid: updatedBids.winningBid,
            };

            // Send confirmation email (don't fail if email fails)
            try {
                const emailHtml = await createBidStatusEmailTemplate(
                    projectDetails,
                    bidDetails,
                    status,
                );
                await sendMail(
                    updatedBids.providerId.email,
                    'Congratulations! Your bid has been accepted',
                    emailHtml
                );
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Don't fail the transaction if email fails
            }
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: `Bid ${status} successfully`,
            data: updatedBid
        });

    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating bid status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.fetchEventOrganizerSelect = async (req, res, next) => {
    try {
        const userId = req.user?._id; // Assuming user is authenticated and user data is in req.user

        // 1. Get upcoming events (events with date in future)
        const upcomingEvents = await Event.find({
            isDelete: { $ne: true },
            createdBy: userId,
            status: "approved",
        })
            .sort({ date: 1 }) // Sort by date ascending (earliest first)
            .limit(10) // Limit to 10 upcoming events
            .lean();

        // Helper function to get full event details
        const eventsWithDetails = await Promise.all(upcomingEvents.map(async (event) => {
            const [organizer, customization, tickets, eventOrder, visibility, review, ticketConfig, photoFrame, refundRequests, eventRequests, placeABid, withdrawals, ticketType] = await Promise.all([
                Organizer.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                EventOrders.find({ eventId: event._id })
                    .select('-qrCode -updatedAt -__v')
                    .populate({
                        path: 'userId',
                        select: 'name email', // Only get the name field from User
                        model: 'User' // Replace with your actual User model name
                    })
                    .lean(),
                Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                eventReview.find({ eventId: event._id, status: "approved" }).select('-updatedAt -isDelete -__v').lean(),
                TicketConfiguration.findOne({ eventId: event._id }).lean(),
                CustomPhotoFrame.findOne({ eventId: event._id }).select('-__v').lean(),
                RefundRequest.find({ eventId: event._id })
                    .populate({ path: 'userId', select: 'name email' })
                    .populate({ path: 'orderId', select: 'refundAmount transactionId refundStatus paymentMethod paymentStatus tickets totalAmount' })
                    .lean(),
                EventsRequest.find({
                    eventId: event._id,
                    providerStatus: "accepted"
                })
                    .populate({
                        path: 'providerId',
                        select: 'serviceCategory reviewCount averageRating name email avatar isVerified socialLinks email experience address username',
                        model: 'User'
                    })
                    .populate({
                        path: 'serviceRequestId',
                        select: 'serviceName category',
                        model: 'ServiceRequest'
                    })
                    .lean(),
                PlaceABid.find({ eventId: event._id })
                    .populate('categoryId', 'name')
                    .lean(),
                Withdrawal.find({ eventId: event._id }).lean(),
                TicketType.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),

            ]);

            // NEW: Get signed projects with provider details
            const signedProjects = await Promise.all(
                placeABid
                    .filter(project => project.isSigned) // Only signed projects
                    .map(async (project) => {
                        // Find the winning bid for this project
                        const winningBid = await Bid.findOne({
                            projectId: project._id,
                            status: 'accepted'
                        })
                            .populate('providerId', 'name email avatar experience rating reviewCount isVerified')
                            .lean();

                        // Get all bids for this project for statistics
                        const allBids = await Bid.find({ projectId: project._id })
                            .populate('providerId', 'name email')
                            .select('bidAmount status createdAt')
                            .lean();

                        return {
                            projectDetails: project,
                            winningBid: winningBid || null,
                            totalBids: allBids.length,
                            bidsStatistics: {
                                totalBids: allBids.length,
                                averageBid: allBids.length > 0 ?
                                    allBids.reduce((sum, bid) => sum + bid.bidAmount, 0) / allBids.length : 0,
                                pendingBids: allBids.filter(bid => bid.status === 'pending').length,
                                acceptedBids: allBids.filter(bid => bid.status === 'accepted').length,
                                rejectedBids: allBids.filter(bid => bid.status === 'rejected').length
                            },
                            projectStatus: project.status,
                            bidStatus: project.bidStatus
                        };
                    })
            );

            const enrichedOrders = eventOrder.map(orderItem => {
                const matchingRefund = refundRequests.find(refund => {
                    const refundOrderId = refund.orderId?._id || refund.orderId;
                    return refundOrderId?.toString() === orderItem._id.toString();
                });

                return {
                    ...orderItem,
                    refundAmount: matchingRefund?.refundAmount || 0,
                    refundStatus: matchingRefund?.refundStatus || null
                };
            });

            // Enrich placeABid with subcategory names
            const enrichedPlaceABid = await Promise.all(placeABid.map(async (bid) => {
                if (bid.subcategoryId) {
                    // Find the category that contains this subcategory
                    const category = await Category.findOne(
                        {
                            "subcategories._id": bid.subcategoryId
                        },
                        {
                            "subcategories.$": 1
                        }
                    ).lean();

                    if (category && category.subcategories && category.subcategories.length > 0) {
                        return {
                            ...bid,
                            subcategoryId: {
                                _id: bid.subcategoryId,
                                name: category.subcategories[0].name
                            }
                        };
                    }
                }
                return bid;
            }));

            // Get project statistics for the event
            const projectStatistics = {
                totalProjects: placeABid.length,
                signedProjects: placeABid.filter(project => project.isSigned).length,
                openForBidding: placeABid.filter(project => project.bidStatus === 'open').length,
                closedProjects: placeABid.filter(project => project.bidStatus === 'closed').length,
                cancelledProjects: placeABid.filter(project => project.bidStatus === 'cancelled').length
            };

            return {
                ...event,
                order: enrichedOrders,
                refundRequests,
                organizer,
                customization,
                tickets,
                review,
                visibility,
                refundPolicy: ticketConfig?.refundPolicy || null,
                isRefundPolicyEnabled: ticketConfig?.isRefundPolicyEnabled || false,
                payStatus: ticketConfig?.payStatus || 'paid',
                purchaseDeadlineDate: ticketConfig?.purchaseDeadlineDate || null,
                photoFrame,
                eventRequests,
                placeABid: enrichedPlaceABid || [],
                withdrawals,
                signedProjects,
                projectStatistics,
                ticketType: ticketType || []
            };
        }));



        res.status(200).json({
            success: true,
            message: "Events fetched successfully",
            __event: eventsWithDetails,
        });

    } catch (error) {
        console.log(error);

        res.status(400).json({
            success: false,
            message: 'Server error',
        });
    }
}


exports.fetchEventWithPlaceABidData = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { eventId, categoryId } = req.params; // Get eventId and categoryId from URL params

        // Validate input
        if (!eventId || !categoryId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID and Category ID are required',
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Event ID or Category ID format',
            });
        }

        // Fetch the place a bid data for the specific event and category
        const placeABidData = await PlaceABid.findOne({
            eventId: eventId,
            categoryId: categoryId
        })
            .populate('eventId', 'eventName eventDate location description') // Populate event details
            .populate('categoryId', 'name') // Populate category details
            .populate('subcategoryId', 'name') // Populate subcategory details
            .populate('createdBy', 'name email') // Populate creator details
            .lean();

        if (!placeABidData) {
            return res.status(404).json({
                success: false,
                message: 'No project found for this event and category',
            });
        }

        // Fetch all bids placed on this project (placeABid)
        const bids = await Bid.find({
            projectId: placeABidData._id
        })
            .populate('providerId', 'name email') // Populate provider details
            .sort({ bidAmount: 1, createdAt: 1 }) // Sort by bid amount (lowest first) then by date
            .lean();

        // Calculate bid statistics
        const bidStats = {
            totalBids: bids.length,
            lowestBid: bids.length > 0 ? bids[0].bidAmount : 0,
            highestBid: bids.length > 0 ? bids[bids.length - 1].bidAmount : 0,
            averageBid: bids.length > 0 ? bids.reduce((sum, bid) => sum + bid.bidAmount, 0) / bids.length : 0
        };

        // Check if current user has placed a bid on this project
        const userBid = userId ? bids.find(bid => bid.providerId._id.toString() === userId.toString()) : null;

        // Prepare response data
        const responseData = {
            project: placeABidData,
            bids: {
                data: bids,
                statistics: bidStats
            },
            userBid: userBid || null,
            userHasBid: !!userBid
        };

        res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching event with bid data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.fetchEventWithAllPlaceABidData = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { projectId } = req.params; // Get projectId from URL params

        // Validate input
        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'Project ID is required',
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Project ID format',
            });
        }

        // 1. Fetch the project from PlaceABid model
        const project = await PlaceABid.findById(projectId)
            .populate('eventId', 'eventName date time location description')
            .populate('categoryId', 'name')
            .populate('createdBy', 'name email')
            .lean();

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found',
            });
        }

        // 2. Fetch subcategory name from Category model
        let subcategoryName = null;
        if (project.subcategoryId) {
            const categoryWithSubcategory = await Category.findOne(
                {
                    _id: project.categoryId,
                    "subcategories._id": project.subcategoryId
                },
                {
                    "subcategories.$": 1
                }
            ).lean();

            if (categoryWithSubcategory && categoryWithSubcategory.subcategories && categoryWithSubcategory.subcategories.length > 0) {
                subcategoryName = categoryWithSubcategory.subcategories[0].name;
            }
        }

        // Add subcategory name to project object
        const projectWithSubcategory = {
            ...project,
            subcategoryId: project.subcategoryId ? {
                _id: project.subcategoryId,
                name: subcategoryName
            } : null
        };

        // 3. Fetch all bids for this project
        const bids = await Bid.find({
            projectId: projectId
        })
            .populate('providerId', 'name username socialLinks address email avatar experience rating reviewCount averageRating serviceCategory')
            .sort({ bidAmount: 1, createdAt: 1 })
            .lean();

        // 4. Calculate bid statistics
        const bidStats = {
            totalBids: bids.length,
            averageBid: bids.length > 0 ?
                bids.reduce((sum, bid) => sum + bid.bidAmount, 0) / bids.length : 0,
            lowestBid: bids.length > 0 ?
                Math.min(...bids.map(bid => bid.bidAmount)) : 0,
            highestBid: bids.length > 0 ?
                Math.max(...bids.map(bid => bid.bidAmount)) : 0
        };

        res.status(200).json({
            success: true,
            message: "Project and bids fetched successfully",
            data: {
                project: projectWithSubcategory,
                bids: bids,
                bidStats: bidStats
            }
        });

    } catch (error) {
        console.error('Error fetching project with bid data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.updateProviderBidStatus = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bidId, projectId } = req.params;
        const { status } = req.body.data;

        // Validate input
        if (!bidId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Bid ID is required',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(bidId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid Bid ID format',
            });
        }

        // Validate status
        if (!status || !['isProviderAccepted'].includes(status)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Valid status (accepted) is required',
            });
        }
        // Find the bid
        const bid = await Bid.findById(bidId).session(session);

        if (!bid) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'Bid not found',
            });
        }

        // // Check if bid is already decided
        if (bid.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Bid has already been ${bid.status}`,
            });
        }

        const updateData = {
            status: "accepted"
        };
        if (status === 'isProviderAccepted') {
            if (!bid.organizrAmount || isNaN(bid.organizrAmount) || bid.organizrAmount <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Valid accepted amount is required',
                });
            }

            updateData.winningBid = bid.organizrAmount;
            updateData.isProviderAccepted = true;
        }

        // // Update the bid
        const updatedBid = await Bid.findByIdAndUpdate(
            bidId,
            updateData,
            { new: true, runValidators: true, session }
        ).populate('providerId', 'name email');

        // // If bid is accepted, update the project to mark it as closed
        if (status === 'isProviderAccepted') {
            await PlaceABid.findByIdAndUpdate(
                projectId,
                {
                    bidStatus: 'closed',
                    isSigned: true
                },
                { new: true, session }
            )
                .populate('eventId')
                .populate('categoryId')
                .populate('createdBy');

            // Reject all other bids for this project
            await Bid.updateMany(
                {
                    projectId: projectId,
                    _id: { $ne: bidId },
                    status: 'pending'
                },
                {
                    status: 'rejected',
                    rejectionReason: 'Another bid was accepted for this project',
                },
                { session }
            );
        }

        //Update Provider gigs
        const eventRequest = await PlaceABid.findById(projectId)

        const previousStatus = eventRequest.status;
        const providerId = req.user._id;
        if (providerId) {
            await updateUserGigCounts(providerId, previousStatus, "pending");
        }

        // // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: `Bid successfully assign to you..`,
            data: updatedBid
        });

    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();

        console.error('Error updating bid status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Helper function to update user gig counts
async function updateUserGigCounts(userId, previousStatus, newStatus) {
    const user = await User.findById(userId);

    if (!user) return;

    // Initialize gigsCounts if not present
    if (!user.gigsCounts) {
        user.gigsCounts = {
            pending: 0,
            ongoing: 0,
            completed: 0,
            cancelled: 0
        };
    }

    // Decrement previous status count if it's a valid status
    if (previousStatus && user.gigsCounts[previousStatus] > 0) {
        user.gigsCounts[previousStatus] -= 1;
    }

    // Increment new status count
    user.gigsCounts[newStatus] = (user.gigsCounts[newStatus] || 0) + 1;

    await user.save();
}