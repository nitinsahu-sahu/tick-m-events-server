const Payment = require("../models/admin-payment/contact-payment");
const axios = require('axios');

// Initialize payment
exports.initiateContactPay = async (req, res) => {
    try {
        const {
            userId, amount = 200, flag, email, eventReqId, bidAmount,
            organizerId, eventId, placeABidId, bidId
        } = req.body;

        const paymentData = {
            amount: amount,
            email: email || 'customer@example.com',
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
        // Create base payment object with common fields
        const paymentDataToSave = {
            amount: amount,
            transactionId: response.data.transId,
            paymentUrl: response.data.link,
            status: 'initiate',
            flag: flag
        };

        // Add conditional fields based on flag
        if (flag === 'contact') {
            paymentDataToSave.userId = userId;

            // Only contact fields - no additional fields needed
        } else if (flag === 'er') {
            // Event Request fields
            paymentDataToSave.eventReqId = eventReqId;
            paymentDataToSave.bidAmount = bidAmount;
            paymentDataToSave.organizerId = organizerId;
            paymentDataToSave.eventId = eventId;
        } else if (flag === 'fsp') {
            // FSP (Final Service Provider) fields
            paymentDataToSave.bidAmount = bidAmount;
            paymentDataToSave.organizerId = organizerId;
            paymentDataToSave.placeABidId = placeABidId;
            paymentDataToSave.bidId = bidId;
            paymentDataToSave.eventId = eventId;
        }

        // Save payment to database
        const payment = new Payment(paymentDataToSave);
        await payment.save();

        res.json({
            success: true,
            paymentUrl: response.data.link,
            transactionId: response.data.transId,
            message: "Payment initiated successfully..."
        });
    } catch (error) {
        console.error('Payment initiation error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment'
        });
    }
};

// Check contact payment status
// exports.checkPaymentStatusContactPay = async (req, res) => {
//     try {
//         const { transactionId } = req.params;

//         const response = await axios.get(
//             `${process.env.FAPSHI_BASE_URL}/payment-status/${transactionId}`,
//             {
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'apikey': process.env.FAPSHI_API_KEY,
//                     'apiuser': process.env.FAPSHI_API_USER,
//                 }
//             }
//         );

//         // Update payment status in database
//         const updatedPayment = await Payment.findOneAndUpdate(
//             { transactionId: response.data.transId },
//             {
//                 status: response.data.status.toLowerCase(),
//                 paymentMethod: response.data.medium,

//             }
//         );

//         if (!updatedPayment) {
//             console.log(`Payment ${response.data.transId} not found in database`);
//             return res.status(404).json({
//                 success: false,
//                 message: 'Payment not found in database'
//             });
//         }
//             console.log('===',updatedPayment);

//         if (updatedPayment.flag == "er") {
//             console.log('===EventReq===');
//             console.log(`Payment ${updatedPayment.transactionId} successfully updated to: ${updatedPayment.status}`);
//         } else if (updatedPayment.flag == "fsp") {
//             console.log('===Find Service Provider===');
//             console.log(`Payment ${updatedPayment.transactionId} successfully updated to: ${updatedPayment.status}`);
//         } else {
//             console.log('===contact=====');
//             console.log(`Payment ${updatedPayment.transactionId} successfully updated to: ${updatedPayment.status}`);
//         }
//         res.status(200).json({
//             success: true,
//             status: response.data.status.toLowerCase(),
//             amount:updatedPayment.amount,
//             currency:updatedPayment.currency,
//             message: "Check successfully..."
//         });
//     } catch (error) {
//         console.error('Payment status check error:', error.message);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to check payment status'
//         });
//     }
// };

// Check pulkit payment status
exports.checkPaymentStatusContactPay = async (req, res) => {
    try {
        const { transactionId } = req.params;

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

        console.log('===>>>', response.data);

        res.status(200).json({
            success: true,
            status: response.data.status.toLowerCase(),
            amount: response.data.amount,
            currency: 'XAF',
            message: "Check successfully..."
        });
    } catch (error) {
        console.error('Payment status check error:', error.message);
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

