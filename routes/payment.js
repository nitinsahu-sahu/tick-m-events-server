// routes/payment.js
const express = require('express');
const router = express.Router();
const { initiatePaymentController, paymentWebhookController } = require('../controllers/admin/fapshi/index');

// Initiate payment
router.post('/initiate', initiatePaymentController);

// Payment webhook (Fapshi will call this)
router.post('/webhook', paymentWebhookController);

// Payment callback (user redirect)
router.get('/callback', (req, res) => {
    // Handle user redirect after payment
    const { status, transId } = req.query;
    res.redirect(`/payment/result?status=${status}&transId=${transId}`);
});

module.exports = router;