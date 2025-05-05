const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/VerifyToken');
const { addToWishlist, getWishlist, removeFromWishlist } = require('../controllers/event-details/wishlistController');

router
    .get(verifyToken, getWishlist)
    .post(verifyToken, addToWishlist)
    .delete('/:eventId', verifyToken, removeFromWishlist)


module.exports = router;