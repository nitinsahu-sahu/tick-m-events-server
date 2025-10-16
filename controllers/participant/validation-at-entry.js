const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');

exports.getOrderasPerEvent = async (req, res) => {
    const userId = req.user._id;

    try {
        // Find all orders for the current user and populate event details
        const userOrders = await EventOrder.find({ userId })
            .populate('eventId')
            .sort({ createdAt: -1 });

        // Filter out orders where the event might be deleted or null
        const validOrders = userOrders.filter(order => 
            order.eventId && !order.eventId.isDelete
        );

        // Format the response to include event details with order information
        const eventsWithOrders = validOrders.map(order => ({
            event: {
                _id: order.eventId._id,
                eventName: order.eventId.eventName,
                date: order.eventId.date,
                time: order.eventId.time,
                category: order.eventId.category,
                eventType: order.eventId.eventType,
                location: order.eventId.location,
                format: order.eventId.format,
                description: order.eventId.description,
                coverImage: order.eventId.coverImage,
                status: order.eventId.status,
                payStatus: order.eventId.payStatus,
                averageRating: order.eventId.averageRating,
                reviewCount: order.eventId.reviewCount
            },
            order: {
                _id: order._id,
                participantDetails: order.participantDetails,
                tickets: order.tickets,
                totalAmount: order.totalAmount,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                transactionId: order.transactionId,
                ticketCode: order.ticketCode,
                verifyEntry: order.verifyEntry,
                entryTime: order.entryTime,
                refundStatus: order.refundStatus,
                createdAt: order.createdAt
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Events with orders fetched successfully',
            data: eventsWithOrders,
            count: eventsWithOrders.length
        });

    } catch (error) {
        console.error('Error fetching events with orders:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};