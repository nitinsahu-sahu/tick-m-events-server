const SignedContract = require('../../models/contract/contract.modal');
const User = require('../../models/User');
const EventRequest = require('../../models/event-request/event-requests.model'); // Assuming you have this model

// Create a new signed contract
exports.createSignedContract = async (req, res) => {
  try {
    const {
      eventReqId, service, providerId, location, eventTime, serviceRequestId, finalBudget,
      explainReq, eventId
    } = req.body;

    // Validate the event request exists
    const eventRequest = await EventRequest.findById(eventReqId);
    if (!eventRequest) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Check if contract already exists for this event request
    const existingContract = await SignedContract.findOne({ eventReqId });
    if (existingContract) {
      return res.status(400).json({ message: 'Contract already exists for this event request' });
    }

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== 'provider') {
      return res.status(404).json({ message: 'Provider not found' });
    }

    const signedContract = new SignedContract({
      eventReqId,
      eventId,
      organizerId: req.user._id,
      serviceRequestId,
      providerId,
      service,
      location,
      eventTime,
      finalBudget,
      explainReq
    });

    await signedContract.save();

    // Update the event request status if needed
    eventRequest.contractStatus = 'signed';
    eventRequest.status = 'accepted';
    await eventRequest.save();

    // Update provider's contractsCount
    provider.contractsCount = (provider.contractsCount || 0) + 1;
    await provider.save();

    res.status(201).json({
      message: 'Contract signed successfully',
      data: signedContract
    });
  } catch (error) {
    console.log(error.message);

    res.status(500).json({
      message: 'Error creating signed contract',
      error: error.message
    });
  }
};

// Get all signed contracts
exports.getAllSignedContracts = async (req, res) => {
  try {
    // Get query parameters
    const { status } = req.query;
    const providerId = req.user._id; // Assuming the provider is the authenticated user

    // Build the base query
    const query = { providerId };

    // Add status filter if provided
    if (status) {
      query.contractStatus = status;
    }

    const contracts = await SignedContract.find(query)
      .populate('eventId', 'eventName date location')
      .populate('organizerId', 'name email avatar')
      .populate('serviceRequestId', 'serviceType budget')
      .populate('eventReqId', 'status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Signed contracts retrieved successfully',
      contracts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving signed contracts',
      error: error.message
    });
  }
};

// Get a single signed contract by ID
exports.getSignedContractById = async (req, res) => {
  try {
    const contract = await SignedContract.findById(req.params.id)
      .populate('eventReqId');

    if (!contract) {
      return res.status(404).json({ message: 'Signed contract not found' });
    }

    res.status(200).json({
      message: 'Signed contract retrieved successfully',
      data: contract
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error retrieving signed contract',
      error: error.message
    });
  }
};

// Update a signed contract
exports.updateSignedContract = async (req, res) => {
  try {
    const { service, location, eventTime, finalBudget, explainReq } = req.body;

    const updatedContract = await SignedContract.findByIdAndUpdate(
      req.params.id,
      { service, location, eventTime, finalBudget, explainReq },
      { new: true, runValidators: true }
    ).populate('eventReqId');

    if (!updatedContract) {
      return res.status(404).json({ message: 'Signed contract not found' });
    }

    res.status(200).json({
      message: 'Contract updated successfully',
      data: updatedContract
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating signed contract',
      error: error.message
    });
  }
};

// Delete a signed contract
exports.deleteSignedContract = async (req, res) => {
  try {
    const deletedContract = await SignedContract.findByIdAndDelete(req.params.id);

    if (!deletedContract) {
      return res.status(404).json({ message: 'Signed contract not found' });
    }

    // Update the event request status if needed
    await EventRequest.findByIdAndUpdate(deletedContract.eventReqId, {
      contractStatus: 'pending'
    });

    res.status(200).json({
      message: 'Contract deleted successfully',
      data: deletedContract
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting signed contract',
      error: error.message
    });
  }
};

// Update contract status
exports.updateContractStatus = async (req, res) => {
  try {
    const { id, eventReqId } = req.params;
    const { newStatus } = req.body;
    // Validate input
    if (!['signed', 'ongoing', 'completed'].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: signed, ongoing, completed'
      });
    }

    // Find and update the contract
    const updatedContract = await SignedContract.findByIdAndUpdate(
      id,
      { contractStatus: newStatus },
      { new: true, runValidators: true }
    ).populate('eventId organizerId serviceRequestId providerId eventReqId');

    await EventRequest.findByIdAndUpdate(
      eventReqId,
      { contractStatus: newStatus },
      { new: true, runValidators: true }
    )

    if (!updatedContract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Optionally update related EventRequest status
    if (newStatus === 'completed') {
      await EventRequest.findByIdAndUpdate(
        updatedContract.eventReqId,
        { status: 'completed' }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Contract status updated successfully',
      data: updatedContract
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating contract status',
      error: error.message
    });
  }
};