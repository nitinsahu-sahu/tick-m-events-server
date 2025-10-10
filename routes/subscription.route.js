const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe } = require('../controllers/subscriptionController');
const { validateSubscription } = require('../validators/event-validator');

// POST /api/subscribe - Subscribe to newsletter
router.post('/subscribe', validateSubscription, subscribe);

// POST /api/unsubscribe - Unsubscribe from newsletter
router.post('/unsubscribe', validateSubscription, unsubscribe);

module.exports = router;