const Payment = require("../models/admin-payment/contact-payment");
const axios = require('axios');

// Initialize payment
exports.initiateContactPay = async (req, res) => {
    try {
        const { userId, amount = 200, flag } = req.body;

        const paymentData = {
            amount: amount,
            email: req.body.email || 'customer@example.com',
            userId: userId,
            redirectUrl: `${process.env.ADMIN_ORIGIN}/payment-success`
        };

        const response = await axios.post(
            `${process.env.FAPSHI_BASE_URL}/initiate-pay`,
            paymentData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.FAPSHI_API_KEY,
                    'apiuser': process.env.FAPSHI_API_USER,
                }
            }
        );

        // Save payment to database
        const payment = new Payment({
            userId: userId,
            amount: amount,
            transactionId: response.data.transId,
            paymentUrl: response.data.link,
            status: 'initiate',
            flag
        });

        await payment.save();

        res.json({
            success: true,
            paymentUrl: response.data.link,
            transactionId: response.data.transId,
            message: "Initiate successfully..."
        });
    } catch (error) {
        console.error('Payment initiation error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment'
        });
    }
};

// Check payment status
exports.checkPaymentStatusContactPay = async (req, res) => {
    try {
        const { transactionId } = req.params;

        let paymentMedium = null;

        const response = await axios.get(
            `${process.env.FAPSHI_BASE_URL}/payment-status/${transactionId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.FAPSHI_API_KEY,
                    'apiuser': process.env.FAPSHI_API_USER,
                }
            }
        );

        const res = response.data;
        // Handle if array or single object
        if (Array.isArray(res) && res.length > 0) {
            paymentMedium = res[0].medium || null;
        } else if (res && typeof res === "object") {
            paymentMedium = res.medium || null;
        }
        // Update payment status in database
        await Payment.findOneAndUpdate(
            { transactionId: res.transId },
            {
                status: res.status.toLowerCase(),
                paymentMethod: paymentMedium,

            }
        );

        res.json({
            success: true,
            status: res.status.toLowerCase(),
            message: "Check successfully..."
        });
    } catch (error) {
        console.error('Payment status check error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to check payment status'
        });
    }
};

// Webhook endpoint
exports.webhookContactPay = async (req, res) => {
    try {
        const { transId, status } = req.body;
        // Update payment status
        const updatedPayment = await Payment.findOneAndUpdate(
            { transactionId: transId },
            {
                status: status.toLowerCase(),
                updatedAt: new Date()
            },
            { new: true }
        );

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ received: false });
    }
};

// Get user transactions
exports.getUserContactPay = async (req, res) => {
    try {
        const { userId } = req.params;
        const transactions = await Payment.find({ userId: userId }).sort({ createdAt: -1 });

        res.json({
            success: true,
            transactions: transactions
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions'
        });
    }
};