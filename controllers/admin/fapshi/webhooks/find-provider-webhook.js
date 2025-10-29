const adminPaymentHistory = require('../../../../models/admin-payment/payment-history')
const EventRequest = require('../../../../models/event-request/event-requests.model');
const axios = require('axios');

exports.findAproviderInitiatePayment = async (req, res) => {
    try {
        // Validate request body
        const { amount, email, userId, currency = 'XAF', redirectUrl, eventReqId, eventId } = req.body;

        if (!amount || !email || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: amount, email, and userId are required'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        // Prepare Fapshi payload
        const fapshiPayload = {
            amount: Math.round(amount), // Ensure integer amount
            email: email,
            userId: userId,
            currency: currency,
            redirectUrl: process.env.FAPSHI_REDIRECT_URL || redirectUrl
        };

        // Make request to Fapshi API
        const fapshiRes = await axios.post(
            "https://sandbox.fapshi.com/initiate-pay",
            fapshiPayload,
            {
                headers: {
                    "Content-Type": "application/json",
                    apikey: process.env.FAPSHI_API_KEY || 'FAK_TEST_177a608c18c0db8c50be',
                    apiuser: process.env.FAPSHI_API_USER || 'f046347f-8d27-40cd-af94-90bc44f3d2c7',
                },
                timeout: 10000,
            }
        );

        // Handle Fapshi response
        if (fapshiRes.data && fapshiRes.data.link) {
            // Store payment record in database (you should implement this)
            await storePaymentRecord({
                transId: fapshiRes.data.transId,
                feeAmount: amount,
                currency: currency,
                organizerId: userId,
                status: 'initiated',
                paymentLink: fapshiRes.data.link,
                eventReqId, eventId
            });

            return res.status(200).json({
                success: true,
                message: 'Payment initiated successfully',
                paymentInfo: {
                    paymentLink: fapshiRes.data.link,
                    transId: fapshiRes.data.transId,
                    amount: amount,
                    currency: currency, eventReqId, eventId
                }
            });
        } else {
            throw new Error('Invalid response from payment gateway');
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during payment initiation'
        });
    }
};

// Helper function to store payment record (implement according to your database)
async function storePaymentRecord(paymentData) {
    try {
        // const Payment = require('../models/Payment');
        await adminPaymentHistory.create(paymentData);

        return true;
    } catch (error) {
        console.error('Error storing payment record:', error);
        // Don't throw error here to not break the payment flow
        return false;
    }
}

exports.findAproviderWebhook = async (req, res) => {
    try {
        const { transId, status } = req.body;
        if (!transId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Missing transId or status'
            });
        }

        // ✅ Fetch updated payment record
        const updatedPayment = await adminPaymentHistory.findOneAndUpdate(
            { transId: transId },
            { status: status.toLowerCase(), updatedAt: new Date() },
            { new: true }
        );

        if (!updatedPayment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found'
            });
        }

        // ✅ Extract bidId and projectId from payment record
        const projectId = updatedPayment.eventReqId || updatedPayment.eventId;

        if (status.toLowerCase() === 'success' && projectId) {
            try {
                // Find event request using its _id (placeABidId)
                const eventRequest = await EventRequest.findById(projectId);

                if (!eventRequest) {
                    res.status(400).json({
                        success: false,
                        message: `⚠️ No EventRequest found for _id: ${projectId}`,
                    });
                } else {
                    eventRequest.providerStatus = 'accepted';
                    eventRequest.orgStatus = 'accepted';
                    eventRequest.projectStatus = 'ongoing';
                    eventRequest.winningBid = 'ongoing';
                    eventRequest.isSigned = true;
                    eventRequest.updatedAt = new Date();

                    await eventRequest.save();
                }
            } catch (err) {
                res.status(400).json({
                    success: false,
                    message: `❌ Failed to update EventRequest after successful payment:`,
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            data: updatedPayment
        });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};