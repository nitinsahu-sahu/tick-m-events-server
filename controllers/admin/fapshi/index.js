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
    // Validate request body
    const { amount, email, userId, bidAmount, currency = 'XAF', redirectUrl, placeABidId, eventReqId, bidId, eventId } = req.body;

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


// Payment confirmation webhook handler
exports.oldpaymentWebhookController = async (req, res) => {
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
                `${process.env.FAPSHI_BASE_URL}/payment-status/${transId}`,
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
                eventRequest.isSigned = true;
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
                        project.isSigned = true;
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

exports.paymentWebhookController = async (req, res) => {
  try {
    const { transId, externalId, fapshiExternalId: bodyFapshiId, status, financialTransId } = req.body;
    const fapshiExternalId = bodyFapshiId || externalId;
    console.log("re", req.body);
    if (!transId && !externalId) {
      return res.status(400).json({
        success: false,
        message: "Missing transId or externalId",
      });
    }

    console.log("Incoming Webhook:", req.body);

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
      console.log("🏦 Found AdminPaymentHistory record");

      // ✅ SAVE financialTransId to admin payment record
      if (financialTransId && !adminPayment.financialTransId) {
        adminPayment.financialTransId = financialTransId;
      }

      adminPayment.status = normalizedStatus;
      adminPayment.paymentMethod = req.body.medium || adminPayment.paymentMethod;
      adminPayment.updatedAt = new Date();
      await adminPayment.save();

      console.log(`✅ AdminPayment ${adminPayment._id} updated to ${normalizedStatus}, financialTransId: ${financialTransId}`);

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

              console.log(`✅ Bid ${bidId} updated successfully`);

              // 🏗️ Also update linked Project if exists
              if (bid.projectId) {
                const project = await Project.findById(bid.projectId);
                if (project) {
                  project.status = "ongoing";
                  project.bidStatus = "closed";
                  project.isSigned = false;
                  project.updatedAt = new Date();
                  await project.save();
                  console.log(`🏗️ Project ${bid.projectId} updated successfully`);
                }
              }
            } else {
              console.log(`⚠️ No Bid found for ID: ${bidId}`);
            }
          } catch (err) {
            console.error(`❌ Error updating Bid ${bidId}:`, err.message);
          }
        }

        // ✅ CASE 2: Update EventRequest
        if (eventReqId) {
          try {
            const eventRequest = await EventRequest.findById(eventReqId);
            console.log("eventReqId", eventReqId);
            if (eventRequest) {
              eventRequest.providerStatus = "accepted";
              eventRequest.orgStatus = "accepted";
              eventRequest.projectStatus = "ongoing";
              eventRequest.isSigned = true;
              eventRequest.winningBid = bidAmount || eventRequest.winningBid;
              eventRequest.updatedAt = new Date();
              await eventRequest.save();

              console.log(`✅ EventRequest ${eventReqId} updated successfully`);
            } else {
              console.log(`⚠️ No EventRequest found for ID: ${eventReqId}`);
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
    console.log("🎟️ Processing Event Order Flow...");
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
        console.log(`🔄 Updating transactionId from ${order.transactionId} → ${transId}`);
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

      console.log(`🎟️ EventOrder ${order._id} updated to ${normalizedStatus}, financialTransId: ${financialTransId}`);

      // --------------------------
      // Reward points logic (idempotent)
      // --------------------------
      try {
        if (order.paymentStatus === "confirmed") {
          // Avoid double-crediting: check if we've already created a reward transaction for this order
          const existingReward = await RewardTransaction.findOne({
            reference: order._id,
            reason: "Ticket Purchase",
            type: "credit"
          });

          if (!existingReward) {
            // Calculate points from paid amount (same formula as you used before)
            const points = Math.floor((Number(order.totalAmount) || 0) / 100);

            if (points > 0) {
              // Create reward transaction and increment user's rewardPoints
              await RewardTransaction.create([{
                userId: order.userId,
                points,
                type: "credit",
                reason: "Ticket Purchase",
                reference: order._id,
                referenceModel: "Order",
              }]);

              await User.findByIdAndUpdate(order.userId, {
                $inc: { rewardPoints: points }
              });
              console.log(`🏅 Credited ${points} points to user ${order.userId} for order ${order._id}`);
            }

            // Handle referral bonus: only if this is the user's first confirmed order
            // Count confirmed orders for this user (including the one just confirmed)
            const confirmedCount = await EventOrder.countDocuments({
              userId: order.userId,
              paymentStatus: "confirmed"
            });

            if (confirmedCount === 1) {
              // this is the first confirmed purchase for user
              const user = await User.findById(order.userId).select('referredBy');
              if (user && user.referredBy) {
                // prevent double referral-credit by checking for a referral RewardTransaction for this order
                const existingRefReward = await RewardTransaction.findOne({
                  userId: user.referredBy,
                  reason: "Referral Bonus",
                  reference: order._id
                });
                if (!existingRefReward) {
                  const referralPoints = 100;
                  await RewardTransaction.create([{
                    userId: user.referredBy,
                    points: referralPoints,
                    type: "credit",
                    reason: "Referral Bonus",
                    reference: order._id,
                    referenceModel: "Order",
                  }]);

                  await User.findByIdAndUpdate(user.referredBy, {
                    $inc: { rewardPoints: referralPoints, referralCount: 1 }
                  });
                  console.log(`🎁 Credited ${referralPoints} referral points to ${user.referredBy} for referral of ${order.userId}`);
                }
              }
            }
          } else {
            console.log(`⚠️ Reward already exists for order ${order._id}, skipping points awarding.`);
          }
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

        }
      } catch (rewardErr) {
        // don't crash webhook on reward issues — log for later
        console.error("❌ Error while awarding rewards for order", order._id, rewardErr);
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

            console.log(`🎫 Updated Event soldTicket for event ${order.eventId}`);
          } else {
            console.log(`⚠️ soldTicket already updated for order ${order._id}, skipping`);
          }
        }
      } catch (err) {
        console.error("❌ Error updating event soldTicket:", err);
      }

      return res.status(200).json({
        success: true,
        message: "Event order webhook processed successfully",
      });
    }

    console.log("⚠️ No matching record found for", { transId, externalId, financialTransId });
    return res.status(404).json({
      success: false,
      message: "No matching record found",
    });
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in payment webhook",
      error: error.message,
    });
  }
};
