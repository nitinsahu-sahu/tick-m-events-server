// controllers/eventOrderController.js

const EventOrder = require('../../models/event-order/EventOrder');
const Event = require('../../models/event-details/Event');

// Create a new order
exports.createOrder = async (req, res) => {
  console.log(req.body);
  console.log(req.user);
  
  // try {
  //   const {
  //     eventId,
  //     userId,
  //     orderAddress,
  //     tickets,
  //     totalAmount,
  //     paymentMethod,
  //     transactionId
  //   } = req.body;

  //   // Validate required fields
  //   if (!eventId || !userId || !orderAddress || !tickets || !totalAmount || !paymentMethod || !transactionId) {
  //     return res.status(400).json({ message: 'Missing required fields' });
  //   }

  //   // Validate tickets array
  //   if (!Array.isArray(tickets) || tickets.length === 0) {
  //     return res.status(400).json({ message: 'At least one ticket is required' });
  //   }

  //   const newOrder = new EventOrder({
  //     eventId,
  //     userId: new mongoose.Types.ObjectId(userId),
  //     orderAddress,
  //     tickets,
  //     totalAmount,
  //     paymentMethod,
  //     transactionId
  //   });

  //   const savedOrder = await newOrder.save();
  //   res.status(201).json(savedOrder);
  // } catch (error) {
  //   console.error('Error creating order:', error);
  //   res.status(500).json({ message: 'Server error', error: error.message });
  // }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const order = await EventOrder.findById(id).populate('userId', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get orders by user ID
exports.getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const orders = await EventOrder.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update order payment status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const validStatuses = ['pending', 'completed', 'failed'];
    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const updateData = {};
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (transactionId) updateData.transactionId = transactionId;

    const updatedOrder = await EventOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const orders = await EventOrder.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('userId', 'name email');

    const count = await EventOrder.countDocuments();

    res.json({
      orders,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page)
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};