const SignedContract = require('../../models/contract/contract.modal');
const EventRequest = require('../../models/event-request/event-requests.model'); // Assuming you have this model

// Create a new signed contract
exports.createSignedContract = async (req, res) => {
  console.log(req.body);
  console.log(req.user._id);

  try {
    const { eventReqId, service, providerId, location, eventTime, serviceRequestId, finalBudget, explainReq, eventId } = req.body;

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
    const contracts = await SignedContract.find()
      .populate('eventReqId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Signed contracts retrieved successfully',
      data: contracts
    });
  } catch (error) {
    res.status(500).json({
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