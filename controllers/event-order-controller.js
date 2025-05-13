// controllers/eventOrderController.js

const EventOrder = require('../models/EventOrder');
const Event = require('../models/event-details/Event');

exports.createOrder = async (req, res) => {
  try {
    const { eventId, tickets, paymentMethod, transactionId } = req.body;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });

    let totalAmount = 0;
    const ticketDetails = [];

    for (const ticket of tickets) {
      const typeInfo = event.ticketTypes.find(t => t.name === ticket.ticketType);
      if (!typeInfo) return res.status(400).json({ success: false, message: `Ticket type ${ticket.ticketType} not available` });

      if (ticket.quantity > typeInfo.available)
        return res.status(400).json({ success: false, message: `Only ${typeInfo.available} tickets available for ${ticket.ticketType}` });

      const subtotal = typeInfo.price * ticket.quantity;
      totalAmount += subtotal;

      ticketDetails.push({
        ticketType: ticket.ticketType,
        quantity: ticket.quantity,
        unitPrice: typeInfo.price,
        subtotal
      });

      // Optionally update stock
      typeInfo.available -= ticket.quantity;
    }

    await event.save(); // Save updated ticket availability

    const order = await EventOrder.create({
      eventId,
      userId,
      tickets: ticketDetails,
      totalAmount,
      paymentMethod,
      transactionId,
      paymentStatus: 'completed'
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
