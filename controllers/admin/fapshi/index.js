const axios = require('axios');
const adminPaymentHistory = require('../../../models/admin-payment/payment-history')
const Bid = require('../../../models/event-request/bid.modal'); // Adjust path as needed
const Project = require('../../../models/event-request/placeBid.modal'); // Adjust path as needed
const EventRequest = require('../../../models/event-request/event-requests.model');

exports.initiatePaymentController = async (req, res) => {
    try {
        // Validate request body
        const { amount, email, userId,bidAmount, currency = 'XAF', redirectUrl, placeABidId, eventReqId, bidId, eventId } = req.body;

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
                bidAmount,
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
                message: 'Missing transId or status',
            });
        }
        if (status.toLowerCase() !== 'successful') {
            return res.status(200).json({
                success: true,
                message: `Payment status is '${status}', no further action taken.`,
            });
        }
        let paymentMedium = null;
        try {
            const fapshiStatusRes = await axios.get(
                `https://sandbox.fapshi.com/payment-status/${transId}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        apikey: process.env.FAPSHI_API_KEY,
                        apiuser: process.env.FAPSHI_API_USER,
                    },
                    timeout: 10000,
                }
            );
 
            const responseData = fapshiStatusRes.data;
 
            // Handle if array or single object
            if (Array.isArray(responseData) && responseData.length > 0) {
                paymentMedium = responseData[0].medium || null;
            } else if (responseData && typeof responseData === "object") {
                paymentMedium = responseData.medium || null;
            }
        } catch (fetchErr) {
            console.error('⚠️ Error fetching payment status from Fapshi:', fetchErr.message);
        }
 
        // ✅ Update payment record in adminPaymentHistory
        const updatedPayment = await adminPaymentHistory.findOneAndUpdate(
            { transId: transId },
            {
                status: status.toLowerCase(),
                updatedAt: new Date(),
                paymentMethod: paymentMedium,
            },
            { new: true }
        );
        if (!updatedPayment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found',
            });
        }
 
        const eventReqId = updatedPayment.eventReqId;
        const bidId = updatedPayment.bidId;
        const bidAmount = updatedPayment?.bidAmount || winningBid || 0;
 
        // ✅ CASE 1: Payment successful & eventReqId exists → Update EventRequest
        if (status.toLowerCase() === 'successful' && eventReqId) {
            try {
                const eventRequest = await EventRequest.findById(eventReqId);
 
                if (!eventRequest) {
                    return res.status(404).json({
                        success: false,
                        message: `⚠️ No EventRequest found for ID: ${eventReqId}`,
                    });
                }
 
                eventRequest.providerStatus = 'accepted';
                eventRequest.orgStatus = 'accepted';
                eventRequest.projectStatus = 'ongoing';
                eventRequest.isSigned = false;
                eventRequest.winningBid = bidAmount;
                eventRequest.updatedAt = new Date();
 
                await eventRequest.save();
 
                return res.status(200).json({
                    success: true,
                    message: '✅ EventRequest updated successfully after payment success',
                    data: eventRequest,
                });
            } catch (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Error while updating EventRequest',
                    error: err.message,
                });
            }
        }
 
        // ✅ CASE 2: Payment successful & bidId exists → Update Bid
        else if (status.toLowerCase() === 'successful' && bidId) {
            try {
                const bid = await Bid.findById(bidId);
 
                if (!bid) {
                    return res.status(404).json({
                        success: false,
                        message: `⚠️ Bid not found for bidId: ${bidId}`,
                    });
                }
 
                bid.isOrgnizerAccepted = true;
                bid.isProviderAccepted = true;
                bid.status = 'accepted';
                bid.adminFeePaid = true;
                bid.adminFeeAmount = updatedPayment.feeAmount || 0;
                bid.winningBid = winningBid;
                bid.organizrAmount = bid.bidAmount;
                await bid.save();
 
                if (bid.projectId) {
                    const project = await Project.findById(bid.projectId);
                    if (project) {
                        project.status = 'ongoing';
                        project.bidStatus = 'closed';
                        project.isSigned = false;
                        await project.save();
                    }
                }
 
                return res.status(200).json({
                    success: true,
                    message: '✅ Bid updated successfully after admin fee payment success',
                    data: bid,
                });
            } catch (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Error while updating Bid',
                    error: err.message,
                });
            }
        }
 
        // ❌ CASE 3: Neither eventReqId nor bidId
        else {
            return res.status(400).json({
                success: false,
                message: 'Payment not successful or missing related IDs (eventReqId/bidId)',
            });
        }
    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        return res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message,
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