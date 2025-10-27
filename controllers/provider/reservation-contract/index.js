const Bid = require('../../../models/event-request/bid.modal');
const EventReq = require('../../../models/event-request/event-requests.model');

exports.getReservactionContracts = async (req, res) => {
    const providerId = req.user._id;
    
    try {
        // Get Active Projects from EventReq (where isSigned is true)
        const activeEventReqProjects = await EventReq.find({
            providerId: providerId,
            isSigned: true,
            projectStatus: { $ne: 'completed' }
        }).populate('eventId serviceRequestId providerId organizerId');

        // Get Completed Projects from EventReq (where projectStatus is completed)
        const completedEventReqProjects = await EventReq.find({
            providerId: providerId,
            projectStatus: 'completed'
        }).populate('eventId serviceRequestId providerId organizerId');

        // Get Active Projects from PlaceABid/Bid (where adminFeePaid is true and winningBid > 0)
        const activeBidProjects = await Bid.find({
            providerId: providerId,
            adminFeePaid: true,
            winningBid: { $gt: 0 }
        }).populate({
            path: 'projectId',
            populate: [
                { path: 'eventId' },
                { path: 'categoryId' },
                { path: 'subcategoryId' }
            ]
        });

        // Get Completed Projects from PlaceABid/Bid (where status in PlaceABid is completed)
        const completedBidProjects = await Bid.find({
            providerId: providerId
        }).populate({
            path: 'projectId',
            match: { status: 'completed' },
            populate: [
                { path: 'eventId' },
                { path: 'categoryId' },
                { path: 'subcategoryId' }
            ]
        }).then(bids => bids.filter(bid => bid.projectId !== null));

        // Combine all active projects
        const allActiveProjects = [
            ...activeEventReqProjects.map(project => ({
                ...project.toObject(),
                projectType: 'EventReq',
                projectStatus: 'active'
            })),
            ...activeBidProjects.map(project => ({
                ...project.toObject(),
                projectType: 'Bid',
                projectStatus: 'active'
            }))
        ];

        // Combine all completed projects
        const allCompletedProjects = [
            ...completedEventReqProjects.map(project => ({
                ...project.toObject(),
                projectType: 'EventReq',
                projectStatus: 'completed'
            })),
            ...completedBidProjects.map(project => ({
                ...project.toObject(),
                projectType: 'Bid',
                projectStatus: 'completed'
            }))
        ];

        // Calculate Total Expected Payments
        const calculateTotalExpectedPayments = (projects) => {
            return projects.reduce((total, project) => {
                if (project.projectType === 'EventReq') {
                    // For EventReq projects, use orgBudget
                    return total + (project.orgBudget || 0);
                } else if (project.projectType === 'Bid') {
                    // For Bid projects, use winningBid
                    return total + (project.winningBid || 0);
                }
                return total;
            }, 0);
        };

        const totalActiveExpectedPayments = calculateTotalExpectedPayments(allActiveProjects);
        const totalCompletedExpectedPayments = calculateTotalExpectedPayments(allCompletedProjects);

        // Prepare response
        const response = {
            success: true,
            message:"Contracts fetch successfully...",
            contracts: {
                activeProjects: {
                    count: allActiveProjects.length,
                    projects: allActiveProjects,
                    totalExpectedPayments: totalActiveExpectedPayments
                },
                completedProjects: {
                    count: allCompletedProjects.length,
                    projects: allCompletedProjects,
                    totalExpectedPayments: totalCompletedExpectedPayments
                },
                summary: {
                    totalActiveProjects: allActiveProjects.length,
                    totalCompletedProjects: allCompletedProjects.length,
                    totalProjects: allActiveProjects.length + allCompletedProjects.length,
                    overallExpectedPayments: totalActiveExpectedPayments + totalCompletedExpectedPayments
                }
            }
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('Error in getReservactionContracts:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};