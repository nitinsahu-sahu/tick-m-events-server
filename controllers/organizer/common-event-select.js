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
        const userId = req.user?._id;
        const currentDateTime = new Date();

        // 1. Get all events (both upcoming and past)
        const allEvents = await Event.find({
            isDelete: { $ne: true },
            createdBy: userId,
            status: "approved",
            step: 4
        }).lean();

        // Separate events into upcoming and past
        const upcomingEvents = allEvents
            .filter(event => {
                const eventDateTime = new Date(`${event.date}T${event.time}`);
                return eventDateTime > currentDateTime;
            })
            .sort((a, b) => {
                const dateTimeA = new Date(`${a.date}T${a.time}`);
                const dateTimeB = new Date(`${b.date}T${b.time}`);
                return dateTimeA - dateTimeB; // Ascending order (soonest first)
            });

        const pastEvents = allEvents
            .filter(event => {
                const eventDateTime = new Date(`${event.date}T${event.time}`);
                return eventDateTime <= currentDateTime;
            })
            .sort((a, b) => {
                const dateTimeA = new Date(`${a.date}T${a.time}`);
                const dateTimeB = new Date(`${b.date}T${b.time}`);
                return dateTimeB - dateTimeA; // Descending order (most recent past events first)
            });

        // Combine: upcoming events first, then past events
        const sortedEvents = [...upcomingEvents, ...pastEvents].slice(0, 10); // Limit to 10 total

        // Helper function to get full event details with enhanced statistics
        const eventsWithDetails = await Promise.all(sortedEvents.map(async (event) => {
            const eventDateTime = new Date(`${event.date}T${event.time}`);
            const isUpcoming = eventDateTime > currentDateTime;
            
            const [
                organizer, customization, tickets, eventOrder, visibility, review, ticketConfig, photoFrame,
                refundRequests, eventRequests, placeABid, withdrawals, ticketType, verifiedTicketsData
            ] = await Promise.all([
                Organizer.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                EventOrders.find({ eventId: event._id })
                    .select('-qrCode -updatedAt -__v')
                    .populate({
                        path: 'userId',
                        select: 'name email',
                        model: 'User'
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
                EventOrders.find({
                    eventId: event._id,
                    'participantDetails.validation': true
                })
                    .populate('userId', 'name')
                    .lean()
            ]);

            const formattedTickets = verifiedTicketsData.flatMap(order => {
                const validatedParticipants = order.participantDetails.filter(participant =>
                    participant.validation === true
                );

                return validatedParticipants.map(participant => ({
                    name: participant.name,
                    age: participant.age,
                    gender: participant.gender,
                    ticketType: order.tickets[0]?.ticketType || 'N/A',
                    entryTime: participant.entryTime || null,
                    ticketCode: order.ticketCode,
                    validation: participant.validation,
                    orderId: order._id
                }));
            });

            const ticketStatistics = calculateTicketStatistics(tickets, ticketType, eventOrder, refundRequests, formattedTickets);
            const orderStatistics = calculateOrderStatistics(eventOrder, refundRequests);
            const paymentStatistics = calculatePaymentStatistics(eventOrder);

            const signedProjects = await Promise.all(
                placeABid
                    .filter(project => project.isSigned)
                    .map(async (project) => {
                        const winningBid = await Bid.findOne({
                            projectId: project._id,
                            status: 'accepted'
                        })
                            .populate('providerId', 'name email avatar experience rating reviewCount isVerified')
                            .lean();

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

            const enrichedPlaceABid = await Promise.all(placeABid.map(async (bid) => {
                if (bid.subcategoryId) {
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

            const projectStatistics = {
                totalProjects: placeABid.length,
                signedProjects: placeABid.filter(project => project.isSigned).length,
                openForBidding: placeABid.filter(project => project.bidStatus === 'open').length,
                closedProjects: placeABid.filter(project => project.bidStatus === 'closed').length,
                cancelledProjects: placeABid.filter(project => project.bidStatus === 'cancelled').length
            };

            return {
                ...event,
                eventStatus: isUpcoming ? 'upcoming' : 'past', // Add event status for frontend
                verifiedTickets: formattedTickets || [],
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
                ticketType: ticketType || [],
                statistics: {
                    tickets: ticketStatistics,
                    orders: orderStatistics,
                    payments: paymentStatistics,
                    overall: {
                        totalRevenue: orderStatistics.totalRevenue,
                        netRevenue: orderStatistics.netRevenue,
                        totalOrders: orderStatistics.totalOrders,
                        totalParticipants: orderStatistics.totalParticipants,
                        averageOrderValue: orderStatistics.averageOrderValue,
                        refundRate: orderStatistics.refundRate,
                        completionRate: orderStatistics.completionRate
                    }
                }
            };
        }));

        res.status(200).json({
            success: true,
            message: "Events fetched successfully",
            __event: eventsWithDetails,
            metadata: {
                totalEvents: sortedEvents.length,
                upcomingCount: upcomingEvents.length,
                pastCount: pastEvents.length
            }
        });

    } catch (error) {
        console.log('error', error);

        res.status(400).json({
            success: false,
            message: 'Server error',
        });
    }
}

// Helper function to calculate comprehensive ticket statistics
// Fixed Helper function to calculate comprehensive ticket statistics
const calculateTicketStatistics = (tickets, ticketType, eventOrder, refundRequests, formattedTickets) => {
    // Calculate total ticket quantity available - FIXED: Parse string to number
    console.log('ticketType', ticketType);

    const totalTicketQuantity = ticketType.reduce((total, t) => {
        const quantity = parseInt(t.quantity) || 0;
        return total + quantity;
    }, 0);

    // Calculate sold tickets (confirmed payments only)
    const soldTickets = ticketType.reduce((total, t) => {
        const quantity = t.sold || 0;
        return total + quantity;
    }, 0);

    // Calculate verified entries
    const verifiedEntries = formattedTickets.length;

    // Calculate pending tickets (pending payments)
    const pendingTickets = soldTickets - verifiedEntries
    // Calculate available tickets (total - sold - pending)
    const availableTickets = totalTicketQuantity - soldTickets;

    // Calculate unverified entries
    const unverifiedEntries = soldTickets - verifiedEntries;

    // Calculate refunded tickets
    const refundedTickets = refundRequests
        .filter(refund => refund.refundStatus === 'approved')
        .reduce((total, refund) => {
            const refundTicketCount = refund.tickets?.reduce((refundTotal, ticket) => {
                return refundTotal + (ticket.quantity || 0);
            }, 0) || 0;
            return total + refundTicketCount;
        }, 0);

    // Calculate ticket utilization rate
    const utilizationRate = totalTicketQuantity > 0 ? (soldTickets / totalTicketQuantity) * 100 : 0;

    // Calculate verification rate
    const verificationRate = soldTickets > 0 ? (verifiedEntries / soldTickets) * 100 : 0;

    // Enhanced: Calculate statistics per ticket type with proper parsing
    const byTicketType = tickets.flatMap(ticketConfig =>
        ticketConfig.tickets?.map(ticket => {
            const totalQuantity = parseInt(ticket.totalTickets) || 0;

            const ticketSold = eventOrder
                .filter(order => order.paymentStatus === 'confirmed')
                .reduce((total, order) => {
                    const orderTicket = order.tickets?.find(t =>
                        t.ticketId.toString() === ticket.id.toString()
                    );
                    return total + (orderTicket?.quantity || 0);
                }, 0);

            const ticketPending = eventOrder
                .filter(order => order.paymentStatus === 'pending')
                .reduce((total, order) => {
                    const orderTicket = order.tickets?.find(t =>
                        t.ticketId.toString() === ticket.id.toString()
                    );
                    return total + (orderTicket?.quantity || 0);
                }, 0);

            const ticketVerified = eventOrder
                .filter(order => order.verifyEntry === true)
                .reduce((total, order) => {
                    const orderTicket = order.tickets?.find(t =>
                        t.ticketId.toString() === ticket.id.toString()
                    );
                    return total + (orderTicket?.quantity || 0);
                }, 0);

            const ticketRefunded = refundRequests
                .filter(refund => refund.refundStatus === 'approved')
                .reduce((total, refund) => {
                    const refundTicket = refund.tickets?.find(t =>
                        t.ticketId.toString() === ticket.id.toString()
                    );
                    return total + (refundTicket?.quantity || 0);
                }, 0);

            return {
                ticketId: ticket.id,
                ticketType: ticket.ticketType,
                price: parseInt(ticket.price) || 0, // Also parse price if it's string
                totalQuantity: totalQuantity,
                sold: ticketSold,
                pending: ticketPending,
                available: totalQuantity - ticketSold - ticketPending,
                verified: ticketVerified,
                refunded: ticketRefunded,
                utilizationRate: totalQuantity > 0 ?
                    Math.round((ticketSold / totalQuantity) * 100 * 100) / 100 : 0,
                revenue: ticketSold * (parseInt(ticket.price) || 0)
            };
        }) || []
    );

    return {
        totalTicketQuantity,
        soldTickets,
        pendingTickets,
        availableTickets,
        verifiedEntries,
        unverifiedEntries,
        refundedTickets,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        verificationRate: Math.round(verificationRate * 100) / 100,
        byTicketType
    };
};

// Helper function to calculate order statistics
const calculateOrderStatistics = (eventOrder, refundRequests) => {
    const totalOrders = eventOrder.length;
    const confirmedOrders = eventOrder.filter(order => order.paymentStatus === 'confirmed').length;
    const pendingOrders = eventOrder.filter(order => order.paymentStatus === 'pending').length;
    const cancelledOrders = eventOrder.filter(order => order.paymentStatus === 'cancelled').length;

    // Calculate total revenue (from confirmed orders only)
    const totalRevenue = eventOrder
        .filter(order => order.paymentStatus === 'confirmed')
        .reduce((total, order) => total + (order.totalAmount || 0), 0);

    // Calculate refunded amount
    const totalRefunded = refundRequests
        .filter(refund => refund.refundStatus === 'approved')
        .reduce((total, refund) => total + (refund.refundAmount || 0), 0);

    // Calculate net revenue
    const netRevenue = totalRevenue - totalRefunded;

    // Calculate total participants
    const totalParticipants = eventOrder.reduce((total, order) => {
        return total + (order.participantDetails?.length || 0);
    }, 0);

    // Calculate average order value
    const averageOrderValue = confirmedOrders > 0 ? totalRevenue / confirmedOrders : 0;

    // Calculate refund rate
    const refundRate = totalRevenue > 0 ? (totalRefunded / totalRevenue) * 100 : 0;

    // Calculate order completion rate
    const completionRate = totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0;

    return {
        totalOrders,
        confirmedOrders,
        pendingOrders,
        cancelledOrders,
        totalRevenue,
        totalRefunded,
        netRevenue,
        totalParticipants,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        refundRate: Math.round(refundRate * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        // Order status distribution
        statusDistribution: {
            confirmed: confirmedOrders,
            pending: pendingOrders,
            cancelled: cancelledOrders
        }
    };
};

// Helper function to calculate payment statistics
const calculatePaymentStatistics = (eventOrder) => {
    const paymentMethods = eventOrder.reduce((acc, order) => {
        const method = order.paymentMethod || 'unknown';
        if (!acc[method]) {
            acc[method] = { count: 0, totalAmount: 0 };
        }
        acc[method].count++;
        acc[method].totalAmount += order.totalAmount || 0;
        return acc;
    }, {});

    const paymentMethodStats = Object.entries(paymentMethods).map(([method, data]) => ({
        method,
        count: data.count,
        totalAmount: data.totalAmount,
        percentage: eventOrder.length > 0 ? Math.round((data.count / eventOrder.length) * 100 * 100) / 100 : 0
    }));

    // Device usage statistics
    const deviceUsage = eventOrder.reduce((acc, order) => {
        const device = order.deviceUsed || 'unknown';
        if (!acc[device]) {
            acc[device] = 0;
        }
        acc[device]++;
        return acc;
    }, {});

    const deviceStats = Object.entries(deviceUsage).map(([device, count]) => ({
        device,
        count,
        percentage: eventOrder.length > 0 ? Math.round((count / eventOrder.length) * 100 * 100) / 100 : 0
    }));

    return {
        paymentMethods: paymentMethodStats,
        deviceUsage: deviceStats,
        totalTransactions: eventOrder.length,
        successfulTransactions: eventOrder.filter(order => order.paymentStatus === 'confirmed').length,
        failedTransactions: eventOrder.filter(order => order.paymentStatus === 'failed').length
    };
};


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

exports.organizerBalance = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { availableBalance } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: "Missing eventId in request params" });
    }
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      { availableBalance },
      { new: true }
    );
 
    if (!updatedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(updatedEvent);
 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};