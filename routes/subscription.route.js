const express = require('express');
const router = express.Router();
const { subscribe } = require('../controllers/subscriptionController');
const { validateSubscription } = require('../validators/event-validator');

router.post('/subscribe', validateSubscription, subscribe);

module.exports = router;