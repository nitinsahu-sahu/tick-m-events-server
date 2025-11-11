// routes/payment.js
const express = require('express');
const router = express.Router();
const { initiatePaymentController, paymentWebhookController, fapshiWebhookController } = require('../controllers/admin/fapshi/index');
const { findAproviderInitiatePayment, findAproviderWebhook } = require('../controllers/admin/fapshi/webhooks/find-provider-webhook');
const { verifyToken } = require('../middleware/VerifyToken');

// Initiate payment
router.post('/initiate', initiatePaymentController);

// Payment webhook (Fapshi will call this)
router.post('/webhook', paymentWebhookController);
router.post('/payment-webhook', fapshiWebhookController);
// Payment callback (user redirect)
router.get('/callback', (req, res) => {
    // Handle user redirect after payment
    const { status, transId } = req.query;
    res.redirect(`/payment/result?status=${status}&transId=${transId}`);
});


// -------------------------Find a service provider----------------------------
// Initiate payment
router.post('/initiate/fsp', verifyToken, findAproviderInitiatePayment);

// Payment webhook (Fapshi will call this)
router.post('/webhook/fsp', verifyToken, findAproviderWebhook);

module.exports = router;