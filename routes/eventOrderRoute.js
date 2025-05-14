// routes/eventOrderRoutes.js

const express = require('express');
const router = express.Router();
const { createOrder } = require('../controllers/event-order/event-order-controller');
const { verifyToken } = require('../middleware/VerifyToken');

router.post("/order", verifyToken, createOrder);

module.exports = router;
