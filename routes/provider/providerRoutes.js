const express = require('express');
const { verifyToken, verifyProvider } = require('../../middleware/VerifyToken');
const {
    placeBid, getProjectBids, getMyBids,
    updateBid, withdrawBid, getMyBidByProject
} = require('../../controllers/event-request/place-a-bid-controller');
const { getStatistics } = require('../../controllers/provider/statistics-performance');
const { getReservactionContracts } = require('../../controllers/provider/reservation-contract');
const router = express.Router()


router.post('/project/:projectId/bids', verifyToken, verifyProvider, placeBid);

router.get('/project/:projectId/bids', verifyToken, verifyProvider, getProjectBids);

router.get('/project/my-bids', verifyToken, verifyProvider, getMyBids);

router.get('/project/:projectId/my-bid', verifyToken, verifyProvider, getMyBidByProject);

router.put('/project/:bidId', verifyToken, verifyProvider, updateBid);

router.delete('/project/:bidId', verifyToken, verifyProvider, withdrawBid);

router.get('/statistics', verifyToken, verifyProvider, getStatistics);

router.get('/reservation-contracts', verifyToken, getReservactionContracts);

module.exports = router