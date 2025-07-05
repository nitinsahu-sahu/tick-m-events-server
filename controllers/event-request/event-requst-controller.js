const EventRequest = require("../../models/event-request/event-requests.model");
const ProviderService = require("../../models/service-reequest/service-request");
const mongoose = require('mongoose');


exports.getRequestsByProvider = async (req, res) => {
    try {
        const { status, page = 1, limit = 10, sortBy = 'createdAt:desc' } = req.query;

        // Build query
        // const query = { providerId: req.user._id, status: "requested-by-organizer" };
        const query = { providerId: req.user._id };
        if (status) {
            query.status = status;
        }

        // Parse sorting
        const [sortField, sortOrder] = sortBy.split(':');
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

        // Pagination
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            EventRequest.find(query)
                .populate('eventId', 'eventName date location time description experience averageRating website certified')
                .populate('organizerId', 'name email avatar')
                .populate('serviceRequestId', 'serviceType budget description additionalOptions')
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
        const { eventId, serviceRequestId, orgRequirement, orgBudget } = req.body;
        const organizerId = req.user._id;

        // Check for existing request
        const existingRequest = await EventRequest.findOne({
            eventId,
            organizerId,
            serviceRequestId
        });

        const existingServiceRequest = await ProviderService.findOne({
            _id: serviceRequestId
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You have already requested this service for this event"
            });
        }

        // Create new request
        const request = await EventRequest.create({
            eventId,
            organizerId,
            serviceRequestId,
            orgRequirement, orgBudget,
            providerId: existingServiceRequest.createdBy
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
    console.log('====================================');
    console.log(req.params);
    console.log('====================================');
    try {
        const request = await EventRequest.findOneAndUpdate(
            {
                _id: req.params.id,
                providerService: { $in: await getProviderServices(req.user._id) }
            },
            { status: req.body.status, providerResponse: req.body.message },
            { new: true }
        );
        console.log(request);

        // Notify organizer
        // io.to(organizerSocketId).emit('requestUpdated', request);

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

exports.updatePraposal =async (req, res) => {
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

    const query = { organizerId: req.user._id };

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