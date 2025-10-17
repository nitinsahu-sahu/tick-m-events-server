const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');
const TicketConfiguration =require('../../models/event-details/Ticket');
const mongoose = require("mongoose");

exports.getOrderasPerEvent = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        // 1. Get all orders for the user
        const orders = await EventOrder.find({ userId }).sort({ createdAt: -1 });

        // 2. Extract all unique eventIds
        const eventIds = [...new Set(orders.map(order => order.eventId))];

        // 3. Fetch corresponding events
        const events = await Event.find({ _id: { $in: eventIds } });
        const eventMap = {};
        events.forEach(event => {
            eventMap[event._id.toString()] = event;
        });

        // 5. Enrich each order
        const enrichedOrders = orders.map(order => {
            const event = eventMap[order.eventId] || null;
           
            return {
                ...order.toObject(),
                eventDetails: event,
              
            };
        }).sort((a, b) => {
            if (!a.eventDate) return 1;
            if (!b.eventDate) return -1;
            return a.eventDate - b.eventDate;
        });
        res.status(200).json(enrichedOrders);
    } catch (error) {
        console.error("Error in getOrdersByUser:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}