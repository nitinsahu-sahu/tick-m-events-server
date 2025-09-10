const express = require('express');
const router = express.Router();
const { createOrder, getOrdersByUser, downloadTicket, verifyTicket, getAllOrders, updateOrderVerifyEntryStatus,
    fetchUserValidatedTickets, getPurchseTicketUserList, 
    downloadInvoice,
    transferTicket} = require('../controllers/event-order/event-order-controller');
const { verifyToken } = require('../middleware/VerifyToken');



// Create a new order
router.post('/transfer-ticket', verifyToken, transferTicket);
router.post("/order", verifyToken, createOrder);
router.get("/validated", verifyToken, fetchUserValidatedTickets);
router.get('/invoice/:transactionId', downloadInvoice);
// Get order by ID
// router.get('/:id', getOrderById);

// Get orders by user ID
router.get('/user/:userId', getOrdersByUser);

// Generate and download ticket PDF
router.get('/ticket/:orderId', downloadTicket);
router.post('/verify-ticket', verifyTicket);
router.patch('/verify-entry', updateOrderVerifyEntryStatus);
// Update order status
// router.patch('/:id/status', updateOrderStatus);

// Get all orders (admin)
router.get('/', getAllOrders);
router.get('/event-ticket-purchase-user', verifyToken, getPurchseTicketUserList);

module.exports = router;
