const axios = require('axios');
const adminPaymentHistory = require('../../../models/admin-payment/payment-history')
const Bid = require('../../../models/event-request/bid.modal'); // Adjust path as needed
const Project = require('../../../models/event-request/placeBid.modal'); // Adjust path as needed
const EventRequest = require('../../../models/event-request/event-requests.model');

exports.initiatePaymentController = async (req, res) => {
    try {
        // Validate request body
        const { amount, email, userId, currency = 'XAF', redirectUrl, placeABidId, eventReqId, bidId, eventId } = req.body;

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
                placeABidId, bidId, eventId, eventReqId
            });

            return res.status(200).json({
                success: true,
                message: 'Payment initiated successfully',
                paymentInfo: {
                    paymentLink: fapshiRes.data.link,
                    transId: fapshiRes.data.transId,
                    amount: amount,
                    currency: currency, placeABidId, bidId, eventId
                }
            });
        } else {
            throw new Error('Invalid response from payment gateway');
        }

    } catch (error) {
        console.error('Payment initiation error:', error.response.data);

        // Handle specific error types
        if (error.response) {
            // Fapshi API returned an error
            return res.status(error.response.status).json({
                success: false,
                message: `Payment gateway error: ${error.response.data?.message || 'Unknown error'}`,
                error: error.response.data
            });
        } else if (error.request) {
            // Request was made but no response received
            return res.status(503).json({
                success: false,
                message: 'Payment gateway is temporarily unavailable'
            });
        } else if (error.code === 'ECONNABORTED') {
            // Request timeout
            return res.status(408).json({
                success: false,
                message: 'Payment gateway request timeout'
            });
        } else {
            // Other errors
            return res.status(500).json({
                success: false,
                message: 'Internal server error during payment initiation'
            });
        }
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

// Payment confirmation webhook handler
exports.paymentWebhookController = async (req, res) => {
    try {
        const { transId, status, winningBid } = req.body;
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
        const bidId = updatedPayment.bidId;
        const projectId = updatedPayment.placeABidId || updatedPayment.eventId;
        const eventReqId = updatedPayment.eventReqId;

        if (!bidId) {
            return res.status(400).json({
                success: false,
                message: 'bidId not found in payment record'
            });
        }

        const bid = await Bid.findById(bidId);
        if (!bid) {
            return res.status(400).json({
                success: false,
                message: `⚠️ Bid not found for bidId: ${bidId}`
            });
        } else {
            const normalizedStatus = status.toLowerCase();

            if (normalizedStatus === 'successful') {
                bid.isOrgnizerAccepted = true;
                bid.isProviderAccepted = true;
                bid.status = 'accepted';
                bid.adminFeePaid = true;
                const adminFee = updatedPayment.feeAmount || bid.bidAmount;
                bid.adminFeeAmount = adminFee;
                bid.winningBid = winningBid;
                bid.organizrAmount = bid.bidAmount;

                await bid.save();
                const project = await Project.findById(projectId).lean();


            } else if (['failed', 'cancelled'].includes(normalizedStatus)) {
                await Bid.findByIdAndUpdate(bidId, { status: 'rejected' });
            }
        }

        if (projectId && bid?.providerId) {
            await Project.findByIdAndUpdate(projectId, {
                status: 'ongoing',
                bidStatus: 'closed',
                isSigned: true,
            });
        }

        if (status.toLowerCase() === 'successful' && eventReqId) {
            try {
                // Find event request using its _id (placeABidId)
                const eventRequest = await EventRequest.findById(eventReqId);
                if (!eventRequest) {
                    return res.status(400).json({
                        success: false,
                        message: `⚠️ No EventRequest found for _id: ${eventReqId}`
                    });
                } else {
                    eventRequest.providerStatus = 'accepted';
                    eventRequest.orgStatus = 'accepted';
                    eventRequest.projectStatus = 'ongoing';
                    eventRequest.isSigned = true;
                    eventRequest.updatedAt = new Date();
                    eventRequest.winningBid = winningBid;
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
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

// Enhanced successful payment handler
async function handleSuccessfulPayment(paymentData, context) {
    try {

        const { bidId, projectId, type } = context;

        if (type === 'admin_fee') {
            // Update bid status to accepted
            await Bid.findByIdAndUpdate(bidId, {
                isOrgnizerAccepted: true,
                status: 'accepted',
                acceptedAt: new Date()
            });

            // Update project status
            await Project.findByIdAndUpdate(projectId, {
                status: 'assigned',
                assignedTo: paymentData.organizerId,
                assignedAt: new Date()
            });

            // Send notifications (implement your notification logic)
            await sendPaymentSuccessNotifications(paymentData, bidId, projectId);

            console.log(`Project ${projectId} assigned to bid ${bidId} after successful admin fee payment`);
        }

        // Add other payment type handlers as needed

    } catch (error) {
        console.error('Error in handleSuccessfulPayment:', error);
        throw error;
    }
}

// Notification helper function
async function sendPaymentSuccessNotifications(paymentData, bidId, projectId) {
    // Implement your notification logic here
    // Email notifications, in-app notifications, etc.
    console.log('Sending payment success notifications');
}

// Notification helper function
async function sendPaymentSuccessNotifications(paymentData, bidId, projectId) {
    // Implement your notification logic here
    // Email notifications, in-app notifications, etc.
    console.log('Sending payment success notifications');
}

async function handleFailedPayment(paymentData) {
    // Implement failed payment logic
    console.log('Payment failed:', paymentData);
}

async function handleCancelledPayment(paymentData) {
    // Implement cancelled payment logic
    console.log('Payment cancelled:', paymentData);
}