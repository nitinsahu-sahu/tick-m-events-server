const Promotion = require('../../models/marketing-engagement/promotion-&-offer.schema');
const Event = require('../../models/event-details/Event');
const EventOrder = require('../../models/event-order/EventOrder');
const User = require('../../models/User');
const TicketConfiguration = require('../../models/event-details/Ticket');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const Visibility = require('../../models/event-details/Visibility');
const Withdrawal = require('../../models/transaction-&-payment/Withdrawal');
// Create Promotion
exports.createPromotion = async (req, res) => {
  const {
    discountValue,
    ticketSelection,
    validityPeriodEnd,
    validityPeriodStart,
    promotionType,
    promoCode,
    eventId,
    earlyBuyerDiscountType, // NEW FIELD
    daysBeforeEvent, // NEW FIELD
  } = req.body;

  try {
    // Validate early buyer discount data
    if (promotionType === 'earlyBuyerDiscount') {
      if (!earlyBuyerDiscountType || !daysBeforeEvent) {
        return res.status(400).json({
          success: false,
          message: 'Early buyer discount requires discount type and days before event'
        });
      }

      if (earlyBuyerDiscountType === 'percentage' && Number(discountValue) > 100) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount cannot exceed 100%'
        });
      }
    }

    const promotionData = {
      discountValue,
      ticketSelection,
      validityPeriodEnd,
      validityPeriodStart,
      promotionType,
      promoCode,
      eventId,
      createdBy: req.user?._id || req.body.createdBy
    };

    // Add early buyer specific fields if applicable
    if (promotionType === 'earlyBuyerDiscount') {
      promotionData.earlyBuyerDiscountType = earlyBuyerDiscountType;
      promotionData.daysBeforeEvent = daysBeforeEvent;
    }

    const promotion = new Promotion(promotionData);

    await promotion.save();
    res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      data: promotion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Promotions
exports.getAllPromotions = async (req, res) => {
  try {
    const promotions = await Promotion.find();
    // const promotions = await Promotion.find().populate('createdBy');
    res.status(200).json({
      message: "Successfully fetch promotions.",
      success: true,
      promotions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Promotion by ID
exports.getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id).populate('createdBy');
    if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Promotion
exports.updatePromotion = async (req, res) => {
  try {
    const {
      discountValue,
      validityPeriodEnd,
      validityPeriodStart,
      promotionType,
      status,
      earlyBuyerDiscountType,
      daysBeforeEvent,
    } = req.body;

    // Validate early buyer discount data if promotion type is earlyBuyerDiscount
    if (promotionType === 'earlyBuyerDiscount') {
      if (!earlyBuyerDiscountType) {
        return res.status(400).json({
          success: false,
          message: 'Early buyer discount type is required'
        });
      }

      if (!daysBeforeEvent) {
        return res.status(400).json({
          success: false,
          message: 'Days before event is required for early buyer discount'
        });
      }

      if (earlyBuyerDiscountType === 'percentage' && Number(discountValue) > 100) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount cannot exceed 100%'
        });
      }

      if (Number(daysBeforeEvent) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Days before event must be a positive number'
        });
      }
    }

    // Validate percentage discount for regular percentage promotions
    if (promotionType === 'percentageDiscount' && Number(discountValue) > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    // Validate date range
    if (validityPeriodStart && validityPeriodEnd) {
      const startDate = new Date(validityPeriodStart);
      const endDate = new Date(validityPeriodEnd);

      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: 'Validity period end date must be after start date'
        });
      }
    }

    // Prepare update data
    const updateData = {
      ...(discountValue !== undefined && { discountValue }),
      ...(validityPeriodStart !== undefined && { validityPeriodStart }),
      ...(validityPeriodEnd !== undefined && { validityPeriodEnd }),
      ...(promotionType !== undefined && { promotionType }),
      ...(status !== undefined && { status }),
    };

    // Add early buyer specific fields if promotion type is earlyBuyerDiscount
    if (promotionType === 'earlyBuyerDiscount') {
      updateData.earlyBuyerDiscountType = earlyBuyerDiscountType;
      updateData.daysBeforeEvent = daysBeforeEvent;
    } else {
      // Clear early buyer specific fields if changing from earlyBuyerDiscount to another type
      updateData.earlyBuyerDiscountType = undefined;
      updateData.daysBeforeEvent = undefined;
    }

    const updated = await Promotion.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Promotion updated successfully',
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Promotion
exports.deletePromotion = async (req, res) => {
  try {
    const deleted = await Promotion.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.status(200).json({ success: true, message: 'Promotion deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Event List with order and participant Id
exports.eventListWithOrderAndParticipant = async (req, res) => {
  try {
    const currentDateTime = new Date();
    const userId = req.user?._id;

    // 1. Get upcoming events
    const proEvents = await Event.find({
      isDelete: { $ne: true },
      createdBy: userId,
      status: "approved",

      // $or: [
      //     {
      //         date: { $gt: currentDateTime.toISOString().split('T')[0] }
      //     },
      //     {
      //         date: currentDateTime.toISOString().split('T')[0],
      //         time: {
      //             $gt: currentDateTime.toLocaleTimeString('en-US',
      //                 { hour12: false }
      //             )
      //         }
      //     }
      // ]
    })
      .sort({ date: 1, startTime: 1 })
      .select('-createdBy -createdAt -updatedAt -isDelete -__v')
      .lean();

    // 2. Get additional data for each event
    const eventsWithCompleteData = await Promise.all(proEvents.map(async (event) => {
      // Get orders for the event
      const orders = await EventOrder.find({
        eventId: event._id.toString()
      })
        .populate({
          path: 'userId',
          select: 'name email profilePicture'
        })
        .lean();

      // Get refund requests for all orders of this event
      const orderIds = orders.map(order => order._id);
      const refundRequests = await RefundRequest.find({
        orderId: { $in: orderIds }
      }).lean();

      // Get ticket configuration for the event
      const ticketConfig = await TicketConfiguration.findOne({
        eventId: event._id
      }).lean();
      const visibility = await Visibility.findOne({
        eventId: event._id
      }).lean();
      // Map refund requests to their respective orders
      const ordersWithRefunds = orders.map(order => {
        const orderRefunds = refundRequests.filter(
          refund => refund.orderId.toString() === order._id.toString()
        );
        return {
          ...order,
          refundRequests: orderRefunds
        };
      });
      const approvedWithdrawals = await Withdrawal.find({
        eventId: event._id,
        status: 'approved'
      }).lean();

      const totalApprovedWithdrawals = approvedWithdrawals.reduce(
        (sum, w) => sum + (w.amount || 0), 0
      );
      return {
        ...event,
        orders: ordersWithRefunds,
        totalApprovedWithdrawals,
        ticketConfiguration: ticketConfig || null, // Include ticket config or null if not found
        visibilityAccess: visibility || null, // Include ticket config or null if not found
        refundStats: {
          total: refundRequests.length,
          pending: refundRequests.filter(r => r.refundStatus === 'pending').length,
          approved: refundRequests.filter(r => r.refundStatus === 'approved').length,
          rejected: refundRequests.filter(r => r.refundStatus === 'rejected').length,
          refunded: refundRequests.filter(r => r.refundStatus === 'refunded').length
        }
      };
    }));

    res.status(200).json({
      success: true,
      message: "Complete event data with orders, refunds, and ticket configuration fetched successfully",
      eventsWithOrdersAndParticiapnt: eventsWithCompleteData,
    });
  } catch (error) {
    console.error("Error fetching complete event data:", error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

exports.validatePromo = async (req, res) => {
  try {
    const { promoCode, eventId, selectedTickets } = req.body;
 
    if (!promoCode || !eventId) {
      return res.status(400).json({
        success: false,
        message: "Promo code and Event ID are required",
      });
    }
 
    const promo = await Promotion.findOne({ promoCode: promoCode.toUpperCase() });
    if (!promo) {
      return res.status(404).json({ success: false, message: "Invalid or expired promo code" });
    }
 
    if (promo.status !== "active") {
      return res.status(400).json({ success: false, message: "Promo code is not active" });
    }
 
    // Validity period check
    const now = new Date();
    const start = new Date(promo.validityPeriodStart);
    const end = new Date(promo.validityPeriodEnd);
    if (now < start || now > end) {
      return res.status(400).json({ success: false, message: "Promo not valid at this time" });
    }
 
    // Event check
    if (promo.eventId.toString() !== eventId) {
      return res.status(400).json({ success: false, message: "Promo not valid for this event" });
    }
 
    // Ticket selection check
    if (promo.ticketSelection) {
      const selectedTicketIds = selectedTickets.map(t => typeof t === "string" ? t : t.ticketId);
      if (!selectedTicketIds.includes(promo.ticketSelection.toString())) {
        return res.status(400).json({ success: false, message: "Promo not valid for selected tickets" });
      }
    }
 
    // ===================== 💰 FIXED Discount Calculation =====================
    let subtotal = 0;
    let discount = 0;
 
    // Calculate subtotal first
    for (const ticket of selectedTickets) {
      const totalForTicket = ticket.unitPrice * ticket.quantity;
      subtotal += totalForTicket;
    }
 
    // Check if promo is applicable
    const isApplicable = !promo.ticketSelection ||
      selectedTickets.some(ticket =>
        promo.ticketSelection.toString() === ticket.ticketId.toString()
      );
 
    if (isApplicable) {
      switch (promo.promotionType) {
        case "percentageDiscount":
          discount = (subtotal * Number(promo.discountValue)) / 100;
          break;
 
        case "fixedValueDiscount":
          // FIXED: Apply fixed discount once to entire subtotal, not per ticket
          discount = Math.min(Number(promo.discountValue), subtotal);
          break;
 
        case "groupOffer":
          if (promo.groupBuy && promo.groupGet) {
            for (const ticket of selectedTickets) {
              const freeTickets = Math.floor(ticket.quantity / promo.groupBuy) * promo.groupGet;
              discount += freeTickets * ticket.unitPrice;
            }
          }
          break;
 
        case "earlyBuyerDiscount":
          if (promo.earlyBuyerDiscountType === "percentage") {
            discount = (subtotal * Number(promo.discountValue)) / 100;
          } else if (promo.earlyBuyerDiscountType === "fixed") {
            discount = Math.min(Number(promo.discountValue), subtotal);
          }
          break;
      }
    }
 
    // Check minimum purchase requirement
    if (promo.minPurchase && subtotal < promo.minPurchase) {
      discount = 0;
    }
 
    const netAmount = Math.max(0, subtotal - discount);
 
    // Map type for frontend
    let promoType;
    switch (promo.promotionType) {
      case "percentageDiscount": promoType = "percentage"; break;
      case "fixedValueDiscount": promoType = "simple"; break;
      case "groupOffer": promoType = "group"; break;
      case "earlyBuyerDiscount": promoType = "earlyBuyer"; break;
      default: promoType = "unknown";
    }
 
    return res.json({
      success: true,
      message: "Promo applied successfully",
      promo: {
        id: promo._id,
        code: promo.promoCode,
        type: promoType,
        value: Number(promo.discountValue),
        groupBuy: promo.groupBuy,
        groupGet: promo.groupGet,
        eventId: promo.eventId,
        ticketSelection: promo.ticketSelection,
        validityPeriodStart: promo.validityPeriodStart,
        validityPeriodEnd: promo.validityPeriodEnd,
        minPurchase: promo.minPurchase,
        earlyBuyerDiscountType: promo.earlyBuyerDiscountType,
        daysBeforeEvent: promo.daysBeforeEvent,
        // Return original promotionType for frontend
        promotionType: promo.promotionType
      },
      calculation: {
        subtotal,
        discount,
        netAmount
      }
    });
 
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};