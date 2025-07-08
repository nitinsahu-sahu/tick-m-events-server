const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/VerifyToken');
const { conversationByuserId, conversation, conversationByLoginUser,getAllActiveUsers } = require('../controllers/chat/convController');
const { sendMessage, msgByConversationId } = require('../controllers/chat/messageController');

// Send a new message
router.get('/message/:conversationId', verifyToken, msgByConversationId)
router.post('/message', verifyToken, sendMessage)

// Conversation Routes
router.get('/conversations', verifyToken, conversationByuserId)
router.get('/user-lists', verifyToken, getAllActiveUsers)
router.get('/conversations-list', verifyToken, conversationByLoginUser)
router.post('/conversation', verifyToken, conversation)

module.exports = router;