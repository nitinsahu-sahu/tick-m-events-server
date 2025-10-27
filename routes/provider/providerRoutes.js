const express = require('express');
const { verifyToken, verifyProvider } = require('../../middleware/VerifyToken');
const {
    placeBid, getProjectBids, getMyBids,
    updateBid, withdrawBid, getMyBidByProject
} = require('../../controllers/event-request/place-a-bid-controller');
const { getStatistics } = require('../../controllers/provider/statistics-performance');
const { getReservactionContracts } = require('../../controllers/provider/reservation-contract');
const router = express.Router()


// Place a bid on a project
router.post('/project/:projectId/bids', verifyToken, verifyProvider, placeBid);

// Get all bids for a project (project owner only)
router.get('/project/:projectId/bids', verifyToken, verifyProvider, getProjectBids);

// Get user's bids
router.get('/project/my-bids', verifyToken, verifyProvider, getMyBids);

// Get specifict project bid
router.get('/project/:projectId/my-bid', verifyToken, verifyProvider, getMyBidByProject);

// Update a bid
router.put('/project/:bidId', verifyToken, verifyProvider, updateBid);

// Withdraw a bid
router.delete('/project/:bidId', verifyToken, verifyProvider, withdrawBid);

// Statistics Page
router.get('/statistics', verifyToken, verifyProvider, getStatistics);

// Reservation And Contracts Page
router.get('/reservation-contracts', verifyToken, verifyProvider, getReservactionContracts);

module.exports = router