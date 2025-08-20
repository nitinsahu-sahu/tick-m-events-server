const express = require('express');
const { verifyToken, verifyProvider } = require('../../middleware/VerifyToken');
const { placeBid,getProjectBids,getMyBids,updateBid,withdrawBid } = require('../../controllers/event-request/place-a-bid-controller');
const router = express.Router()


// Place a bid on a project
router.post('/', verifyToken, verifyProvider, placeBid);

// Get all bids for a project (project owner only)
router.get('/', verifyToken, verifyProvider, getProjectBids);

// Get user's bids
router.get('/my-bids', verifyToken, verifyProvider, getMyBids);

// Update a bid
router.put('/:bidId', verifyToken, verifyProvider, updateBid);

// Withdraw a bid
router.delete('/:bidId', verifyToken, verifyProvider, withdrawBid);

module.exports = router