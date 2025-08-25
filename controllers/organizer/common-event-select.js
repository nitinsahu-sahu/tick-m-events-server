const Event = require('../../models/event-details/Event');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Ticket = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const eventReview = require('../../models/event-details/eventReview');
const EventOrders = require('../../models/event-order/EventOrder');
const CustomPhotoFrame = require('../../models/event-details/CustomPhotoFrame');
const TicketConfiguration = require('../../models/event-details/Ticket');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const EventsRequest = require('../../models/event-request/event-requests.model');
const mongoose = require("mongoose")
const PlaceABid = require('../../models/event-request/placeBid.modal');
const Bid = require('../../models/event-request/bid.modal');

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
            const [organizer, customization, tickets, eventOrder, visibility, review, ticketConfig, photoFrame, refundRequests, eventRequests] = await Promise.all([
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
                    .populate({ path: 'orderId', select: 'paymentStatus tickets' })
                    .lean(),
                EventsRequest.find({
                    eventId: event._id,
                    status: { $ne: 'requested-by-organizer' }
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
                    .lean()
            ]);

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
                eventRequests
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
        const { eventId } = req.params; // Get eventId from URL params

        // Validate input
        if (!eventId) {
            return res.status(400).json({
                success: false,
                message: 'Event ID is required',
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Event ID format',
            });
        }

        // Fetch all place a bid data for the specific event
        const placeABidData = await PlaceABid.find({
            eventId: eventId
        })
        .populate('eventId', 'eventName eventDate location description')
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .populate('createdBy', 'name email')
        .lean();

        if (!placeABidData || placeABidData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No projects found for this event',
            });
        }

        // Get all project IDs
        const projectIds = placeABidData.map(project => project._id);

        // Fetch all bids for these projects
        const bids = await Bid.find({
            projectId: { $in: projectIds }
        })
        .populate('providerId', 'name email')
        .populate('projectId', 'categoryId subcategoryId orgBudget')
        .sort({ bidAmount: 1, createdAt: 1 })
        .lean();

        // Organize bids by project and calculate statistics
        const projectsWithBids = placeABidData.map(project => {
            const projectBids = bids.filter(bid => bid.projectId._id.toString() === project._id.toString());
            
            const bidStats = {
                totalBids: projectBids.length,
                lowestBid: projectBids.length > 0 ? projectBids[0].bidAmount : 0,
                highestBid: projectBids.length > 0 ? projectBids[projectBids.length - 1].bidAmount : 0,
                averageBid: projectBids.length > 0 ? 
                    projectBids.reduce((sum, bid) => sum + bid.bidAmount, 0) / projectBids.length : 0
            };

            // Check if current user has placed a bid on this project
            const userBid = userId ? projectBids.find(bid => bid.providerId._id.toString() === userId.toString()) : null;

            return {
                project: project,
                bids: {
                    data: projectBids,
                    statistics: bidStats
                },
                userBid: userBid || null,
                userHasBid: !!userBid
            };
        });

        res.status(200).json({
            success: true,
            data: projectsWithBids,
            totalProjects: projectsWithBids.length
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