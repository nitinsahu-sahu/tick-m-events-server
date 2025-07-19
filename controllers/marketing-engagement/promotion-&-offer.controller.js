const Promotion = require('../../models/marketing-engagement/promotion-&-offer.schema');
const Event = require('../../models/event-details/Event');
const EventOrder = require('../../models/event-order/EventOrder');
const User = require('../../models/User');

// Create Promotion
exports.createPromotion = async (req, res) => {
    const {
        discountValue,
        ticketSelection,
        validityPeriodEnd,
        validityPeriodStart,
        promotionType,
        promoCode,
    } = req.body;
    try {
        const promotion = new Promotion({
            discountValue,
            ticketSelection,
            validityPeriodEnd,
            validityPeriodStart,
            promotionType,
            promoCode,
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
            $or: [
                {
                    date: { $gt: currentDateTime.toISOString().split('T')[0] }
                },
                {
                    date: currentDateTime.toISOString().split('T')[0],
                    time: {
                        $gt: currentDateTime.toLocaleTimeString('en-US',
                            { hour12: false }
                        )
                    }
                }
            ]
        })
            .sort({ date: 1, startTime: 1 })
            .limit(10)
            .lean();

        // 2. Get orders for each event
        const eventsWithOrders = await Promise.all(proEvents.map(async (event) => {
            const orders = await EventOrder.find({
                eventId: event._id.toString()
            })
                .populate({
                    path: 'userId',
                    select: 'name email profilePicture' // Include whatever user fields you need
                })
                .lean();

            return {
                ...event,
                orders: orders || [] // Include empty array if no orders
            };
        }));

        res.status(200).json({
            success: true,
            message: "Events with orders fetched successfully",
            eventsWithOrdersAndParticiapnt: eventsWithOrders,
        });
    } catch (error) {
        console.error("Error fetching events with orders:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};