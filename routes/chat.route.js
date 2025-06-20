const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessagesByServiceRequest,
  getMessagesByEvent,
  getConversation,
  updateMessage,
  deleteMessage,getMessagesByFilter
} = require('../controllers/chat/messageController');
const { verifyToken } = require('../middleware/VerifyToken');

// Send a new message
router.post('/', verifyToken, sendMessage);

// Get messages by service request ID
router.get('/service-request/:serviceRequestId', verifyToken, getMessagesByServiceRequest);

// Get messages by event ID
router.get('/event/:eventId', verifyToken, getMessagesByEvent);

// Get conversation between two users for a service request
router.get('/conversation/:serviceRequestId/:userId1/:userId2', verifyToken, getConversation);

// Update a message
router.put('/:id', verifyToken, updateMessage);

// Delete a message
router.delete('/:id', verifyToken, deleteMessage);

// Add this new route
router.get('/', verifyToken, getMessagesByFilter);

module.exports = router;