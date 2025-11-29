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
        } else if (flag === 'ptp') {
            // PTP (Participant Ticket Purchase) fields
            paymentDataToSave.userId = userId;
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
//             return res.status(404).json({
//                 success: false,
//                 message: 'Payment not found in database'
//             });
//         }

//         if (updatedPayment.flag == "er") {
//         } else if (updatedPayment.flag == "fsp") {
//            
//         } else {
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
        await Payment.findOneAndUpdate(
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

// exports.whatsappSendMessage = async (req, res) => {
//     try {
//         // Replace with your actual token and phone number ID
//         const token = "EAAQkUMZCDbhEBQMz6cOmSEfiSWGM1TUiDrJOIaouZBIg5ktla9OlwLHYufPqXNZCAcnzHoQtLShzBMHAwzcV2Km9iuJWyirHfXSgfkuGM7vG6wbGFScIIZCDB9KTgZACqtTHlL4TTcdozslscNZBZBgybYq3ORFTuY1LVZC2NrDzGYO1e2DECjaiEeKU5aTBIebp5LuMLBWoLPOdjdZBMSJXIvtsLFb7LPZBtSU9QirlxZBtZCyxAVncSWwIbJrePVsZAjfxEJWZCryY2xBo8oc9VThdSzVDGB";
//         const phoneNumberId = "942747208911780";
        
//         const requestData = {
//             messaging_product: "whatsapp",
//             to: "+919111118326", // receiver's phone number
//             type: "text",
//             text: { 
//                 body: "This is a text message." 
//             },
//         };

//         const whatsAppRes = await axios.post(
//             `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
//             requestData,
//             {
//                 headers: { 
//                     Authorization: `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );

//         console.log('WhatsApp API Response:', whatsAppRes.data);

//         res.json({
//             success: true,
//             data: whatsAppRes.data,
//             message: "Message sent successfully"
//         });

//     } catch (error) {
//         console.log('WhatsApp Send Message Error:', error.response?.data || error.message);
        
//         // Detailed error handling
//         if (error.response) {
//             // The request was made and the server responded with a status code
//             // that falls out of the range of 2xx
//             const status = error.response.status;
//             const errorData = error.response.data;
            
//             let errorMessage = 'Failed to send WhatsApp message';
            
//             switch (status) {
//                 case 400:
//                     errorMessage = 'Bad Request - Check your request parameters';
//                     break;
//                 case 401:
//                     errorMessage = 'Unauthorized - Invalid or expired access token';
//                     break;
//                 case 403:
//                     errorMessage = 'Forbidden - Permission denied';
//                     break;
//                 case 404:
//                     errorMessage = 'Not Found - Invalid phone number ID';
//                     break;
//                 case 429:
//                     errorMessage = 'Rate Limit Exceeded - Too many requests';
//                     break;
//                 case 500:
//                     errorMessage = 'Internal Server Error - Facebook API issue';
//                     break;
//                 default:
//                     errorMessage = `HTTP Error: ${status}`;
//             }
            
//             res.status(status).json({
//                 success: false,
//                 message: errorMessage,
//                 error: errorData,
//                 statusCode: status
//             });
//         } else if (error.request) {
//             // The request was made but no response was received
//             res.status(503).json({
//                 success: false,
//                 message: 'No response received from WhatsApp API',
//                 error: error.message
//             });
//         } else {
//             // Something happened in setting up the request that triggered an Error
//             res.status(500).json({
//                 success: false,
//                 message: 'Request setup error',
//                 error: error.message
//             });
//         }
//     }
// };


