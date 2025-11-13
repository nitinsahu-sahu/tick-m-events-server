// routes/payment.js
const express = require('express');
const router = express.Router();
const { initiatePaymentController, oldpaymentWebhookController, paymentWebhookController } = require('../controllers/admin/fapshi/index');
const { findAproviderInitiatePayment, findAproviderWebhook } = require('../controllers/admin/fapshi/webhooks/find-provider-webhook');
const { verifyToken } = require('../middleware/VerifyToken');

// Initiate payment
router.post('/initiate', initiatePaymentController);

// Payment webhook (Fapshi will call this)
router.post('/payment-webhook', oldpaymentWebhookController);
router.post('/webhook', paymentWebhookController);
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