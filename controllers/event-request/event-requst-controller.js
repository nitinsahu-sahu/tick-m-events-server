const EventRequest = require("../../models/event-request/event-requests.model");
const Bid = require("../../models/event-request/bid.modal");
const User = require("../../models/User");
const ProviderService = require("../../models/service-reequest/service-request");
const mongoose = require('mongoose');

exports.serviceUpdateStatus = async (req, res) => {
    try {
        const { id } = req.params; // EventRequest ID
        const { newStatus } = req.body; // Status to update

        // Validate the status value
        const validStatuses = ['pending', 'ongoing', 'completed', 'cancelled'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value. Must be one of: "pending", "ongoing", "completed", or "cancelled"'
            });
        }

        // Find the event request
        const eventRequest = await EventRequest.findById(id)
            .populate('providerId', 'gigsCounts')

        if (!eventRequest) {
            return res.status(404).json({
                success: false,
                message: 'Event request not found'
            });
        }

        const previousStatus = eventRequest.projectStatus;
        const providerId = eventRequest.providerId;

        // Update the event request status
        eventRequest.projectStatus = newStatus;
        await eventRequest.save();

        // Update user gig counts based on status transition
        if (providerId) {
            await updateUserGigCounts(providerId, previousStatus, newStatus);
        }

        res.status(200).json({
            success: true,
            message: `Service project status updated successfully from ${previousStatus} to ${newStatus}`,
            data: eventRequest
        });

    } catch (error) {
        console.error('Error updating service project status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating service project status',
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

exports.getRequestsByProvider = async (req, res) => {
    try {
        const userId = req.user._id; // Assuming providerId comes from route params
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Provider ID is required'
            });
        }

        const activeEventReqProjects = await EventRequest.find({
            providerId: userId,
            isSigned: true,
            projectStatus: { $ne: 'completed' }
        })
            .populate('eventId', 'eventName date location time description experience averageRating website certified')
            .populate('organizerId', 'name email avatar')
            .populate('providerId', 'name email avatar')
            .populate('serviceRequestId', 'serviceType budget description additionalOptions')

        const activeBidProjects = await Bid.find({
            providerId: userId,
            adminFeePaid: true,
            winningBid: { $gt: 0 }
        }).populate({
            path: 'projectId',
            populate: [
                { path: 'eventId' },
                { path: 'categoryId' },
                { path: 'subcategoryId' },
                { path: 'createdBy', select: 'name email avatar' },  
 
            ]
        });

        const filteredProjects = activeBidProjects.filter(bid =>
            bid.projectId &&
            (bid.projectId.status === 'pending' || bid.projectId.status === 'ongoing')
        );

        const allActiveProjects = [
            ...activeEventReqProjects.map(project => ({
                ...project.toObject(),
                projectType: 'EventReq',
                projectStatus: 'active'
            })),
            ...filteredProjects.map(project => ({
                ...project.toObject(),
                projectType: 'Bid',
                projectStatus: 'active'
            }))
        ];



        // Fetch all requests for this provider
        const requests = await EventRequest.find({
            $or: [
                { providerId: userId },
                { organizerId: userId }
            ]
        })
            .populate('eventId', 'eventName date location time description experience averageRating website certified')
            .populate('organizerId', 'name email avatar')
            .populate('providerId', 'name email avatar')
            .populate('serviceRequestId', 'serviceType budget description additionalOptions')
            .lean()

        // Filter requests based on conditions
        const pendingRequests = requests.filter(request =>
            !request.isSigned
        );

        const signedReqests = requests.filter(request =>
            request.isSigned &&
            (request.projectStatus === 'pending' || request.projectStatus === 'ongoing')
        );

        const completedRequests = requests.filter(request =>
            request.isSigned &&
            request.projectStatus === 'completed'
        );



        res.status(200).json({
            success: true,
            pendingRequests,
            signedReqests,
            completedRequests,
            totalRequests: requests,
            allActiveProjects,
            counts: {
                active: allActiveProjects.length,
                pending: pendingRequests.length,
                confirmed: signedReqests.length,
                completed: completedRequests.length,
                total: requests.length
            }
        });

    } catch (error) {
        console.error('Error fetching provider requests:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching requests'
        });
    }
};

// Get Validated tickets
exports.updateRequestById = async (req, res) => {
    try {
        // Reject all other requests for same service type
        const currentRequest = await EventRequest.findById(req.params.id);
        const serviceType = (await ProviderService.findById(currentRequest.providerService)).serviceType;

        await EventRequest.updateMany(
            {
                event: currentRequest.event,
                status: 'accepted-by-provider',
                _id: { $ne: req.params.id },
                providerService: { $in: await getServicesByType(serviceType) }
            },
            { status: 'rejected-by-organizer' }
        );

        const updated = await EventRequest.findByIdAndUpdate(
            req.params.id,
            { status: 'selected-by-organizer' },
            { new: true }
        );

        // Notify all involved providers
        notifyProvidersAboutSelection(currentRequest.event, serviceType);

        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Organizer sends request to provider
exports.createRequest = async (req, res) => {

    try {
        const { serviceTime, eventId, serviceRequestId, orgRequirement,
            orgBudget, eventLocation, orgAdditionalRequirement, providerId } = req.body;
        const organizerId = req.user._id;

        // Check for existing request for the same service and event by the same organizer
        const existingRequest = await EventRequest.findOne({
            eventId,
            organizerId,
            serviceRequestId
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You have already requested this service for this event"
            });
        }

        // Create new request (providerId will be null if not found)
        const request = await EventRequest.create({
            eventId,
            organizerId,
            serviceRequestId,
            orgRequirement,
            orgBudget,
            eventLocation,
            orgAdditionalRequirement,
            providerId,
            serviceTime,
            providerId // This will be null if service request not found
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

// Provider responds to request
exports.providerRespondOnReq = async (req, res) => {
    try {
        const request = await EventRequest.findOneAndUpdate(
            {
                _id: req.params.id,
                providerService: { $in: await getProviderServices(req.user._id) }
            },
            { status: req.body.status, providerResponse: req.body.message },
            { new: true }
        );
        res.json(request);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.sendProposal = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, days, message } = req.body;

        const eventRequest = await EventRequest.findById(id);

        if (!eventRequest) {
            return res.status(404).json({ message: "Request not found" });
        }

        eventRequest.providerProposal = {
            amount,
            days,
            message
        };

        eventRequest.providerHasProposed = true;
        eventRequest.status = "accepted-by-provider";
        // eventRequest.contractStatus="ongoing";

        await eventRequest.save();

        res.status(200).json({ message: "Proposal sent successfully", eventRequest });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getPraposal = async (req, res) => {
    try {
        const request = await EventRequest.findById(req.params.id)
            .populate('eventId organizerId serviceRequestId providerId');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.json(request);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updatePraposal = async (req, res) => {
    try {
        const { amount, days, message } = req.body;

        const request = await EventRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'EventRequest not found' });
        }

        request.providerProposal = { amount, days, message };
        request.providerHasProposed = true;

        await request.save();

        res.json({ message: 'Proposal updated successfully', proposal: request.providerProposal });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating proposal' });
    }
};

exports.getRequestsByOrganizer = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'createdAt:desc' } = req.query;

        const query = { organizerId: req.user._id, providerStatus: "accepted" };

        // Sorting
        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            EventRequest.find(query)
                .populate('eventId', 'eventName date location time description averageRating')
                .populate('organizerId', 'name email avatar')
                .populate('serviceRequestId', 'serviceType budget description additionalOptions')
                .populate('providerId', 'name email avatar')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            EventRequest.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: requests.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            requests
        });

    } catch (error) {
        console.error('Error fetching requests by organizer:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching organizer requests'
        });
    }
};

async function getProviderServices(providerId) {
    try {
        // Validate input
        if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
            throw new Error('Invalid provider ID');
        }

        // Find all services where provider matches, selecting only the _id field
        const services = await ProviderService.find(
            { provider: providerId },
            '_id' // Projection - only return _id field
        ).lean(); // .lean() for better performance with simple JS objects

        // Extract just the ID strings from the documents
        return services.map(service => service._id.toString());

    } catch (error) {
        console.error('Error in getProviderServices:', error);
        throw error; // Re-throw for calling function to handle
    }
}

exports.updateRequestStatusByOrganizer = async (req, res) => {
    try {
        const { id } = req.params; // EventRequest ID
        const { status, contractStatus } = req.body;

        // Validate status
        const validStatuses = [
            'accepted-by-organizer',
            'rejected-by-organizer',
        ];
        const validContractStatuses = ['pending', 'ongoing'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        if (!validContractStatuses.includes(contractStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid contractStatus value' });
        }

        // Find and update
        const updatedRequest = await EventRequest.findByIdAndUpdate(
            id,
            {
                status,
                contractStatus,
            },
            { new: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Request status updated successfully',
            data: updatedRequest,
        });
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating request status',
        });
    }
};

exports.serviceAwarded = async (req, res) => {
    try {
        const { id } = req.params; // EventRequest ID

        // Find the event request first to get providerId
        const eventRequest = await EventRequest.findById(id);
        if (!eventRequest) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        // Prepare update object for pending status only
        const updateData = {
            isSigned: true,
            orgStatus: 'accepted',
            projectStatus: 'pending'
        };

        // Update provider's contractsCount if provider exists
        if (eventRequest.providerId) {
            await User.findByIdAndUpdate(
                eventRequest.providerId,
                {
                    $inc: {
                        'gigsCounts.pending': 1
                    },
                    // Set default values if the field doesn't exist
                    $setOnInsert: {
                        'gigsCounts.completed': 0,
                        'gigsCounts.cancelled': 0,
                        'gigsCounts.ongoing': 0
                    }
                },
                {
                    upsert: true, // Create the field if it doesn't exist
                    setDefaultsOnInsert: true, // Set default values if creating
                    new: true
                }
            );
        }

        // Update the event request
        const updatedRequest = await EventRequest.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Service request marked as pending successfully',
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error updating service award status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating service status',
        });
    }
};

exports.updateProviderStatus = async (req, res) => {
    try {
        const { id } = req.params; // EventRequest ID
        const providerId = req.user._id; // Assuming the provider is the authenticated user


        // Validate the status value
        const validStatuses = ['accepted', 'pending', 'rejected'];
        if (!validStatuses.includes(req.body.proStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value. Must be one of: accepted, pending, rejected'
            });
        }

        // Find the event request and update the provider status
        const updatedRequest = await EventRequest.findOneAndUpdate(
            {
                _id: id,
            },
            {
                providerStatus: req.body.proStatus,
                providerId
            },
            { new: true, runValidators: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({
                success: false,
                message: 'Request not found or you are not authorized to update this request'
            });
        }

        res.status(200).json({
            success: true,
            message: `Provider status updated to ${req.body.proStatus} successfully`,
            request: updatedRequest
        });

    } catch (error) {
        console.error('Error updating provider status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating provider status',
        });
    }
};

exports.markRequestAsCompleted = async (req, res) => {
    try {
        const { id } = req.params;

        // Find and populate eventId to get the event date
        const request = await EventRequest.findById(id)
            .populate('eventId', 'date');

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Check status
        if (request.status !== 'accepted-by-organizer') {
            return res.status(400).json({ success: false, message: 'Request is not accepted by organizer' });
        }

        // Check contractStatus
        if (request.contractStatus !== 'ongoing') {
            return res.status(400).json({ success: false, message: 'Only ongoing contracts can be completed' });
        }

        const eventDate = new Date(request.eventId.date);
        const now = new Date();

        if (now <= eventDate) {
            return res.status(400).json({
                success: false,
                message: 'Cannot mark as completed before the event date',
            });
        }

        // Update contractStatus
        request.contractStatus = 'completed';
        await request.save();

        return res.status(200).json({
            success: true,
            message: 'Contract marked as completed',
            data: request,
        });

    } catch (error) {
        console.error('❌ Error marking request as completed:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.cancelEventReq = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id; // Assuming you have user info in req.user

        // Validate ID
        if (!id) {
            return res.status(400).json({ success: false, message: 'Invalid request ID' });
        }

        // Find the request
        const request = await EventRequest.findById(id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Check if user is authorized (either organizer or provider)
        const isOrganizer = request.organizerId.equals(userId);
        const isProvider = request.providerId.equals(userId);

        if (!isOrganizer && !isProvider) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized - You can only cancel your own requests'
            });
        }

        // Determine new status based on who is canceling
        let newStatus;
        if (isOrganizer) {
            newStatus = 'rejected-by-organizer';
        } else {
            newStatus = 'rejected-by-provider';
        }

        // Update the status (soft delete approach - recommended)
        const updatedRequest = await EventRequest.findByIdAndUpdate(
            id,
            {
                status: newStatus,
                contractStatus: 'cancelled',
                discussion: req.body.reason || 'Request canceled by user'
            },
            { new: true }
        );

        // Alternatively, to hard delete:
        // await EventRequest.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Request canceled successfully',
            data: updatedRequest
        });

    } catch (error) {
        console.error('❌ Error canceling request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getProviderAcceptedReq = async (req, res) => {
    try {
        const query = {
            organizerId: req.user._id,
            status: { $in: ['accepted-by-provider', 'accepted'] },
            // contractStatus: { $in: ['signed', 'ongoing','completed'] }
        };
        const [requests] = await Promise.all([
            EventRequest.find(query)
                .populate('eventId', 'eventName date location time description averageRating')
                .populate('organizerId', 'name email avatar')
                .populate('serviceRequestId', 'serviceType budget description additionalOptions')
                .populate('providerId', 'name email avatar')
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            requests
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching organizer requests'
        });
    }
};

exports.getActiveContractsByProvider = async (req, res) => {
    try {
        const providerId = new mongoose.Types.ObjectId(req.user._id); // force ObjectId

        const query = {
            providerId,
            contractStatus: { $in: ['signed', 'ongoing', 'completed'] }
        };


        const requests = await EventRequest.find(query)
            .populate('eventId', 'eventName date location time description experience averageRating website certified')
            .populate('organizerId', 'name email avatar')
            .populate('serviceRequestId', 'serviceType budget description additionalOptions')
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({
            success: true,
            count: requests.length,
            requests
        });

    } catch (error) {
        console.error('Error fetching active provider contracts:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching active contracts'
        });
    }
};