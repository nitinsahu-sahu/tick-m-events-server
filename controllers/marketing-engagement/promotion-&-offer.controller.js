const Promotion = require('../../models/marketing-engagement/promotion-&-offer.schema');
const Event = require('../../models/event-details/Event');
const EventOrder = require('../../models/event-order/EventOrder');
const User = require('../../models/User');
const TicketConfiguration = require('../../models/event-details/Ticket');
const RefundRequest = require('../../models/refund-managment/RefundRequest');
const Visibility = require('../../models/event-details/Visibility');

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
    } = req.body;
    try {
        const promotion = new Promotion({
            discountValue,
            ticketSelection,
            validityPeriodEnd,
            validityPeriodStart,
            promotionType,
            promoCode,
            eventId,
            createdBy: req.user?._id || req.body.createdBy
        });

        await promotion.save();
        res.status(201).json({
            success: true,
            message: 'Promotion created successfully',
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
        const updated = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Promotion not found' });
        res.status(200).json({ success: true, message: 'Promotion updated successfully', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

            return {
                ...event,
                orders: ordersWithRefunds,
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