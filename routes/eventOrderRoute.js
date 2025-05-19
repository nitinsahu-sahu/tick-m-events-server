const express = require('express');
const router = express.Router();
const { createOrder, getOrdersByUser,downloadTicket } = require('../controllers/event-order/event-order-controller');
const { verifyToken } = require('../middleware/VerifyToken');



// Create a new order
router.post("/order", verifyToken, createOrder);

// Get order by ID
// router.get('/:id', getOrderById);

// Get orders by user ID
router.get('/user/:userId', getOrdersByUser);

// Generate and download ticket PDF
router.get('/ticket/:orderId', downloadTicket);

// Update order status
// router.patch('/:id/status', updateOrderStatus);

// Get all orders (admin)
// router.get('/', getAllOrders);

module.exports = router;
