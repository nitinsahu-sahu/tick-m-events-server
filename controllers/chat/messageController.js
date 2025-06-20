const Message = require('../../models/chat/chat.schema');
const mongoose = require('mongoose');

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
    const { eventId, receiverId, serviceRequestId, message, type } = req.body;
    const senderId = req.user._id
    if (!senderId || !eventId || !receiverId || !serviceRequestId || !message) {
        res.status(400);
        throw new Error('Please include all required fields');
    }

    const newMessage = await Message.create({
        senderId,
        eventId,
        receiverId,
        serviceRequestId,
        message,
        type: type || 'text' // default to 'text' if not specified
    });

    if (newMessage) {
        res.status(201).json(newMessage);
    } else {
        res.status(400);
        throw new Error('Invalid message data');
    }
};

// @desc    Get all messages for a specific service request
// @route   GET /api/messages/service-request/:serviceRequestId
// @access  Private
exports.getMessagesByServiceRequest = async (req, res) => {
    const messages = await Message.find({
        serviceRequestId: req.params.serviceRequestId
    })
        .populate('senderId', 'name avatar')
        .populate('receiverId', 'name avatar')
        .sort({ createdAt: 1 });

    res.json(messages);
};

// @desc    Get all messages for an event
// @route   GET /api/messages/event/:eventId
// @access  Private
exports.getMessagesByEvent = async (req, res) => {
    const messages = await Message.find({
        eventId: req.params.eventId
    })
        .populate('senderId', 'name avatar')
        .populate('receiverId', 'name avatar')
        .sort({ createdAt: 1 });

    res.json(messages);
};

// @desc    Get conversation between two users for a specific service request
// @route   GET /api/messages/conversation/:serviceRequestId/:userId1/:userId2
// @access  Private
exports.getConversation = async (req, res) => {
    const { serviceRequestId, userId1, userId2 } = req.params;

    const messages = await Message.find({
        serviceRequestId,
        $or: [
            { senderId: userId1, receiverId: userId2 },
            { senderId: userId2, receiverId: userId1 }
        ]
    })
        .populate('senderId', 'name avatar')
        .populate('receiverId', 'name avatar')
        .sort({ createdAt: 1 });

    res.json(messages);
};

// @desc    Update message status (e.g., mark as read)
// @route   PUT /api/messages/:id
// @access  Private
exports.updateMessage = async (req, res) => {
    const message = await Message.findById(req.params.id);

    if (!message) {
        res.status(404);
        throw new Error('Message not found');
    }

    // Add any fields you want to update
    const updatedMessage = await Message.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    );

    res.json(updatedMessage);
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
    const message = await Message.findById(req.params.id);

    if (!message) {
        res.status(404);
        throw new Error('Message not found');
    }

    await message.remove();
    res.json({ id: req.params.id });
};

// @desc    Get messages with flexible filtering by any combination of IDs
// @route   GET /api/messages/filter
// @access  Private
exports.getMessagesByFilter = async (req, res) => {
    try {
        const { eventId, receiverId, serviceRequestId } = req.query;
        const userId = req.user._id;

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        // Build the query object dynamically based on provided parameters
        const query = {};

        // Validate and add eventId to query
        if (eventId) {
            if (!mongoose.Types.ObjectId.isValid(eventId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid event ID format'
                });
            }
            query.eventId = eventId;
        }

        // Validate and add receiverId to query
        if (receiverId) {
            if (!mongoose.Types.ObjectId.isValid(receiverId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid receiver ID format'
                });
            }
            query.receiverId = receiverId;
        }

        // Validate and add serviceRequestId to query
        if (serviceRequestId) {
            if (!mongoose.Types.ObjectId.isValid(serviceRequestId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid service request ID format'
                });
            }
            query.serviceRequestId = serviceRequestId;
        }

        // Only add user filter if no other filters are provided
        if (Object.keys(query).length === 0) {
            query.$or = [
                { senderId: userId },
                { receiverId: userId }
            ];
        }

        // Execute query
        const messages = await Message.find(query)
            // .populate('senderId', 'name avatar email')
            // .populate('receiverId', 'name avatar email')
            // .populate('eventId', 'eventName date')
            // .populate('serviceRequestId', 'serviceType status')
            .sort({ createdAt: -1 }); // Newest first

        // Check if messages were found
        if (!messages || messages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No messages found matching the criteria',
                messages: []
            });
        }

        // Successful response
        res.status(200).json({
            success: true,
            count: messages.length,
            messages
        });

    } catch (error) {
        console.error('Error fetching messages:', error);

        // Handle specific error types
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format provided'
            });
        }

        // Generic server error
        res.status(500).json({
            success: false,
            message: 'Server error while fetching messages',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};