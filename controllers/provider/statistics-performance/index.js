const User = require('../../../models/User');
const Bid = require('../../../models/event-request/bid.modal');
const EventReq = require('../../../models/event-request/event-requests.model');
const mongoose = require("mongoose")

exports.getStatistics = async (req, res) => {
    const providerID = req.user._id;

    try {
        // Get the user with gigsCounts
        const user = await User.findById(providerID).select('gigsCounts');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Extract gig counts from user document
        const { completed } = user.gigsCounts;
        const totalGigs = completed;

        // Calculate completion rate (avoid division by zero)
        const completionRate = totalGigs > 0
            ? (completed / totalGigs) * 100
            : 0;

        // Calculate total revenue from completed projects (Bid model)
        const revenueResult = await Bid.aggregate([
            {
                $match: {
                    providerId: new mongoose.Types.ObjectId(providerID),
                    status: 'accepted',
                    winningBid: { $gt: 0 }
                }
            },
            {
                $lookup: {
                    from: 'placeabids',
                    localField: 'projectId',
                    foreignField: '_id',
                    as: 'project'
                }
            },
            {
                $unwind: {
                    path: '$project',
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $match: {
                    'project.status': 'completed',
                    'project.isSigned': true
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$winningBid' },
                    completedProjectsCount: { $sum: 1 }
                }
            }
        ]);

        // Calculate total revenue from completed event requests
        const eventReqRevenueResult = await EventReq.aggregate([
            {
                $match: {
                    providerId: new mongoose.Types.ObjectId(providerID),
                    projectStatus: 'completed', // Only completed event requests
                    isSigned: true // Only signed event requests
                }
            },
            {
                $group: {
                    _id: null,
                    totalEventReqRevenue: { $sum: '$providerProposal.amount' },
                    completedEventReqsCount: { $sum: 1 }
                }
            }
        ]);

        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        const completedProjectsCount = revenueResult.length > 0 ? revenueResult[0].completedProjectsCount : 0;

        const totalEventReqRevenue = eventReqRevenueResult.length > 0 ? eventReqRevenueResult[0].totalEventReqRevenue : 0;
        const completedEventReqsCount = eventReqRevenueResult.length > 0 ? eventReqRevenueResult[0].completedEventReqsCount : 0;

        // Calculate combined totals
        const combinedTotalRevenue = totalRevenue + totalEventReqRevenue;
        const totalCompletedProjects = completedProjectsCount + completedEventReqsCount;

        // Prepare statistics response
        const statistics = {
            gigs: {
                completed: completed,
                completionRate: Math.round(completionRate * 100) / 100,
                completedProjects: totalCompletedProjects,
                breakdown: {
                    bidProjects: completedProjectsCount,
                    eventRequests: completedEventReqsCount
                }
            },
            revenue: {
                total: combinedTotalRevenue,
                currency: 'XAF',
                total: totalRevenue + totalEventReqRevenue,
                breakdown: {
                    bidRevenue: totalRevenue,
                    eventReqRevenue: totalEventReqRevenue
                }
            },
            ratings: {
                average: user.averageRating || 0,
                totalReviews: user.reviewCount || 0
            }
        };

        res.status(200).json({
            success: true,
            message: 'Statistics fetched successfully',
            statistics
        });

    } catch (err) {
        console.error('Error fetching statistics:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};