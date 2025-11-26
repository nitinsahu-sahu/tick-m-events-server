const axios = require('axios');
const adminPaymentHistory = require('../../../models/admin-payment/payment-history')
const Bid = require('../../../models/event-request/bid.modal'); // Adjust path as needed
const Project = require('../../../models/event-request/placeBid.modal'); // Adjust path as needed
const EventRequest = require('../../../models/event-request/event-requests.model');
const EventOrder = require('../../../models/event-order/EventOrder');
const RewardTransaction = require("../../../models/RewardTrans");
const User = require("../../../models/User");
const Event = require('../../../models/event-details/Event');
const TicketType = require("../../../models/TicketType");
const TicketConfiguration = require('../../../models/event-details/Ticket');

exports.initiatePaymentController = async (req, res) => {
  try {
    const {
      amount, email, userId, bidAmount, currency = 'XAF',
      redirectUrl, placeABidId, eventReqId, bidId, eventId
    } = req.body;

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
      // redirectUrl: process.env.FAPSHI_REDIRECT_URL || redirectUrl
      redirectUrl: `${process.env.ADMIN_ORIGIN}/payment-success`
    };

    // Make request to Fapshi API
    const fapshiRes = await axios.post(
      `${process.env.FAPSHI_BASE_URL}/initiate-pay`,
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
        financialTransId: fapshiRes.data.financialTransId || null,
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

exports.paymentWebhookController = async (req, res) => {
  try {
    const { transId, externalId, fapshiExternalId: bodyFapshiId, status, financialTransId } = req.body;
    const fapshiExternalId = bodyFapshiId || externalId;
    if (!transId && !externalId) {
      return res.status(400).json({
        success: false,
        message: "Missing transId or externalId",
      });
    }
 
    let normalizedStatus = status?.toLowerCase() || "pending";
    if (normalizedStatus === "successful") normalizedStatus = "success";
 
    // 🟢 Step 1: Try to find admin payment by financialTransId or transId
    let adminPayment = null;
 
    if (financialTransId) {
      adminPayment = await adminPaymentHistory.findOne({
        $or: [{ financialTransId }, { transId }, { transId: externalId }],
      });
    } else {
      adminPayment = await adminPaymentHistory.findOne({
        $or: [{ transId }, { transId: externalId }],
      });
    }
 
    if (adminPayment) {
      // ✅ SAVE financialTransId to admin payment record
      if (financialTransId && !adminPayment.financialTransId) {
        adminPayment.financialTransId = financialTransId;
      }
 
      adminPayment.status = normalizedStatus;
      adminPayment.paymentMethod = req.body.medium || adminPayment.paymentMethod;
      adminPayment.updatedAt = new Date();
      await adminPayment.save();
 
      // 🧩 If payment successful, update related Bid / EventRequest
      if (normalizedStatus === "success") {
        const { eventReqId, bidId, bidAmount } = adminPayment;
 
        // ✅ CASE 1: Update Bid
        if (bidId) {
          try {
            const bid = await Bid.findById(bidId);
            if (bid) {
              bid.isOrgnizerAccepted = true;
              bid.isProviderAccepted = true;
              bid.status = "accepted";
              bid.adminFeePaid = true;
              bid.adminFeeAmount = adminPayment.feeAmount || 0;
              bid.winningBid = bidAmount || 0;
              bid.organizrAmount = bid.bidAmount;
              bid.updatedAt = new Date();
              await bid.save();
 
              // 🏗️ Also update linked Project if exists
              if (bid.projectId) {
                const project = await Project.findById(bid.projectId);
                if (project) {
                  project.status = "ongoing";
                  project.bidStatus = "closed";
                  project.isSigned = true;
                  project.updatedAt = new Date();
                  await project.save();
                }
              }
            } else {
              return res.status(400).json({
                success: false,
                message: `⚠️ No Bid found for ID: ${bidId}`,
              });
            }
          } catch (err) {
            console.error(`❌ Error updating Bid ${bidId}:`, err.message);
          }
        }
 
        // ✅ CASE 2: Update EventRequest
        if (eventReqId) {
          try {
            const eventRequest = await EventRequest.findById(eventReqId);
            if (eventRequest) {
              eventRequest.providerStatus = "accepted";
              eventRequest.orgStatus = "accepted";
              eventRequest.projectStatus = "ongoing";
              eventRequest.isSigned = true;
              eventRequest.winningBid = bidAmount || eventRequest.winningBid;
              eventRequest.updatedAt = new Date();
              await eventRequest.save();
            } else {
              return res.status(400).json({
                success: false,
                message: `⚠️ No EventRequest found for ID: ${eventReqId}`,
              });
            }
          } catch (err) {
            console.error(`❌ Error updating EventRequest ${eventReqId}:`, err.message);
          }
        }
      }
 
      return res.status(200).json({
        success: true,
        message: "Admin payment webhook processed successfully",
      });
    }
 
    // 🟣 Step 2: If not admin payment → check EventOrder
 
    const order = await EventOrder.findOne({
      $or: [
        { transactionId: transId },
        { transactionId: externalId },
        { fapshiExternalId: transId },
        { fapshiExternalId: externalId }
      ],
    });
 
    if (order) {
      // ✅ SAVE financialTransId to EventOrder
      if (financialTransId && !order.financialTransId) {
        order.financialTransId = financialTransId;
      }
 
      // ✅ Also save transId if not already present
      if (transId && order.transactionId !== transId) {
        order.transactionId = transId; // overwrite with real Fapshi transId
      }
 
      if (normalizedStatus === "success") {
        order.paymentStatus = "confirmed";
      } else if (normalizedStatus === "failed") {
        order.paymentStatus = "denied";
      } else {
        order.paymentStatus = normalizedStatus;
      }
      order.updatedAt = new Date();
      order.paymentMethod = req.body.medium || order.paymentMethod;
 
      // ✅ If payment is successful, also set payment date
      if (order.paymentStatus === "confirmed" && !order.paymentDate) {
        order.paymentDate = new Date();
      }
      await order.save({ validateBeforeSave: false });
 
      // --------------------------
      // Reward points logic (idempotent)
      // --------------------------
      try {
        if (order.paymentStatus === "confirmed") {
          try {
            // Check if any reward already exists for this order
            const existingReward = await RewardTransaction.findOne({
              reference: order._id,
              reason: "Ticket Purchase",
              type: "credit"
            });
 
            if (!existingReward) {
              // Check if this is the first confirmed order for the user
              const orderCount = await EventOrder.countDocuments({
                userId: order.userId,
                paymentStatus: "confirmed"
              });
 
              if (orderCount === 1) {
                // First purchase logic
                const firstPurchasePoints = 100;
 
                // Credit points to buyer
                await RewardTransaction.create({
                  userId: order.userId,
                  points: firstPurchasePoints,
                  type: "credit",
                  reason: "First Purchase Bonus",
                  reference: order._id,
                  referenceModel: "Order"
                });
 
                await User.findByIdAndUpdate(order.userId, {
                  $inc: { rewardPoints: firstPurchasePoints }
                });
 
                // Credit points to referrer if exists
                const user = await User.findById(order.userId).select('referredBy');
                if (user && user.referredBy) {
                  await RewardTransaction.create({
                    userId: user.referredBy,
                    points: firstPurchasePoints,
                    type: "credit",
                    reason: "Referral Bonus",
                    reference: order._id,
                    referenceModel: "Order"
                  });
 
                  await User.findByIdAndUpdate(user.referredBy, {
                    $inc: { rewardPoints: firstPurchasePoints }
                  });
                }
 
              } else {
                // Not first purchase, normal reward points
                const points = Math.floor((Number(order.totalAmount) || 0) / 100);
 
                if (points > 0) {
                  await RewardTransaction.create({
                    userId: order.userId,
                    points,
                    type: "credit",
                    reason: "Ticket Purchase",
                    reference: order._id,
                    referenceModel: "Order"
                  });
 
                  await User.findByIdAndUpdate(order.userId, {
                    $inc: { rewardPoints: points }
                  });
 
                }
              }
              // ------------------------------------------------------
              // ⭐ ADDED: TICKET STOCK + SOLD COUNT UPDATE LOGIC
              // -----------------------------------------------------
              // Prevent double-update
              if (!order.ticketsUpdated) {
 
                // 1. Update TicketConfiguration
                const ticketConfig = await TicketConfiguration.findOne({ eventId: order.eventId });
                if (ticketConfig) {
                  for (const orderedTicket of order.tickets) {
                    const configTicket = ticketConfig.tickets.find(
                      t => t.id.toString() === orderedTicket.ticketId.toString()
                    );
 
                    if (configTicket) {
                      configTicket.totalTickets = (
                        Number(configTicket.totalTickets) - Number(orderedTicket.quantity)
                      ).toString();
                    }
                  }
                  await ticketConfig.save();
                }
 
                // 2. Update TicketType sold count
                for (const orderedTicket of order.tickets) {
                  await TicketType.findByIdAndUpdate(
                    orderedTicket.ticketId,
                    { $inc: { sold: Number(orderedTicket.quantity) } }
                  );
                }
 
                // Mark as processed
                order.ticketsUpdated = true;
                await order.save({ validateBeforeSave: false });
              }
 
            } else {
              return res.status(400).json({
                success: false,
                message: `⚠️ Reward already exists for order ${order._id}, skipping.`,
              });
            }
          } catch (error) {
            return res.status(500).json({
              success: false,
              message: "Error awarding rewards for order",
              error: error.message,
            });
          }
        }
 
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error while awarding rewards for order",
          error: error.message,
        });
      }
      // ----------------------------------------------
      // UPDATE EVENT SOLD TICKETS ONLY ON CONFIRMED PAYMENT
      // ----------------------------------------------
      try {
        if (order.paymentStatus === "confirmed") {
 
          // Prevent multiple increments
          if (!order.soldTicketUpdated) {
 
            // Calculate total sold tickets from the order
            const totalSoldTickets = order.tickets.reduce((sum, ticket) => {
              return sum + (Number(ticket.quantity) || 0);
            }, 0);
 
            // Increment the event's soldTicket count
            await Event.findByIdAndUpdate(order.eventId, {
              $inc: { soldTicket: totalSoldTickets }
            });
 
            // Mark as updated so no duplicates
            order.soldTicketUpdated = true;
            await order.save({ validateBeforeSave: false });
 
          } else {
            return res.status(400).json({
              success: false,
              message: `⚠️ soldTicket already updated for order ${order._id}, skipping`,
            });
          }
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Error updating event soldTicket:",
          error: error.message,
        });
      }
 
      return res.status(200).json({
        success: true,
        message: "Event order webhook processed successfully",
      });
    }
 
    return res.status(404).json({
      success: false,
      message: "No matching record found",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error in payment webhook",
      error: error.message,
    });
  }
};
