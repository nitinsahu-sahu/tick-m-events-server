const EventRequest = require("../../models/event-request/event-requests.model");
const ProviderService = require("../../models/service-reequest/service-request");
const mongoose = require('mongoose');
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
        const { eventId, serviceId, message } = req.body;
        const organizerId = req.user._id;

        // Check for existing request
        const existingRequest = await EventRequest.findOne({
            eventId,
            organizer: organizerId,
            providerService: serviceId
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
            organizer: organizerId,
            providerService: serviceId,
            message,
        });

        res.status(201).json({
            success: true,
            request,
            message: "Service requested successfully"
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