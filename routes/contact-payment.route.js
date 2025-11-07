const express = require('express');
const { initiateContactPay, checkPaymentStatusContactPay, webhookContactPay, getUserContactPay } = require('../controllers/conact-pay.controller');
const router = express.Router();


// Create a new signed contract
router.post('/initiate-payment', initiateContactPay);

router.get('/payment-status/:transactionId', checkPaymentStatusContactPay);

router.post('/webhook/payment-status', webhookContactPay);

router.get('/transactions/:userId', getUserContactPay);

module.exports = router;