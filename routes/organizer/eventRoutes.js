const express = require('express');
const router = express.Router();
const { getUserEventsWithDetails, deleteEvent, updateEvents, updateEventVisibility } = require('../../controllers/organizer/editEvent.Controller');
const { verifyToken, verifyOrganizer } = require('../../middleware/VerifyToken');
const { fetchEventOrganizerSelect, fetchEventWithPlaceABidData, 
    fetchEventWithAllPlaceABidData, updateBidStatus, updateProviderBidStatus, organizerBalance } = require('../../controllers/organizer/common-event-select');
const { postPlaceABid,getBids,getBidById,updatePlaceABidStatus } = require('../../controllers/event-request/place-a-bid-controller');

router.route('/edit-events')
    .get(verifyToken, getUserEventsWithDetails)
router.put("/:eventId/balance", organizerBalance);

router.delete('/edit-events/:eventId', verifyToken, deleteEvent);
router.patch('/edit-events/:eventId', verifyToken, updateEvents);
router.patch('/edit-event-visibility/:eventId', verifyToken, updateEventVisibility);
router.get('/event-com', verifyToken, fetchEventOrganizerSelect);
router.get('/event/:eventId/category/:categoryId/bid-data', verifyToken, fetchEventWithPlaceABidData);
router.get('/place-a-bid/:projectId/bid-data', verifyToken, fetchEventWithAllPlaceABidData);
router.put('/place-a-bid/:projectId/:bidId', verifyToken, updateBidStatus);
router.put('/place-a-bid/:projectId/:bidId/providerAcceptance', verifyToken, updateProviderBidStatus);

// Place a Bid
router.post('/place-a-bid', verifyToken, verifyOrganizer, postPlaceABid)
router.get('/place-a-bid', verifyToken, getBids)
router.get('/place-a-bid/:projectId', verifyToken, getBidById)
router.put('/place-a-bid/:id/:providerId/projectUpdate', verifyToken, updatePlaceABidStatus)

module.exports = router;