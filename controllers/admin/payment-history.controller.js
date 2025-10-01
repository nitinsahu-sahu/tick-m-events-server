const User = require('../../models/User');
const Event = require('../../models/event-details/Event');
const EventReq = require('../../models/event-request/event-requests.model');
const PlaceABid = require('../../models/event-request/placeBid.modal');
const PaymentHistory = require('../../models/admin-payment/payment-history');
const Bid = require('../../models/event-request/bid.modal');
const axios = require('axios');

exports.paymentHistoryController = async (req, res) => {
    try {
        const { transId, bidId, eventId, eventReqId, placeABidId, amount } = req.body;

        // Verify payment with Fapshi
        const verificationResponse = await axios.get(
            `https://sandbox.fapshi.com/transaction/${transId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.FAPSHI_API_KEY,
                    'apiuser': process.env.FAPSHI_API_USER
                }
            }
        );

        if (verificationResponse.data.status === 'successful' &&
            verificationResponse.data.amount >= amount) {

            // Mark admin fee as paid in your database
            await Bid.findByIdAndUpdate(bidId, {
                adminFeePaid: true,
            });
            const payment = new PaymentHistory({
                eventId,
                organizerId,
                eventReqId: eventReqId || null,
                placeABidId: placeABidId || null,
                bidId: bidId || null,
                userId: req.user._id,
                transactionId: transId,
                feeAmount: amount,
                status: "success"
            });

            await payment.save();

            return res.json({ success: true });
        }

        return res.json({ success: false });
    } catch (error) {
        console.error('Admin fee verification error:', error);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
};