const express = require('express');
const router = express.Router();
const { getUserEventsWithDetails, deleteEvent, updateEvents, updateEventVisibility } = require('../../controllers/organizer/editEvent.Controller');
const { verifyToken, verifyOrganizer } = require('../../middleware/VerifyToken');
const { fetchEventOrganizerSelect, fetchEventWithPlaceABidData, fetchEventWithAllPlaceABidData } = require('../../controllers/organizer/common-event-select');
const { postPlaceABid,getBids,getBidById } = require('../../controllers/event-request/place-a-bid-controller');

router.route('/edit-events')
    .get(verifyToken, getUserEventsWithDetails)

router.delete('/edit-events/:eventId', verifyToken, deleteEvent);
router.patch('/edit-events/:eventId', verifyToken, updateEvents);
router.patch('/edit-event-visibility/:eventId', verifyToken, updateEventVisibility);
router.get('/event-com', verifyToken, fetchEventOrganizerSelect);
router.get('/event/:eventId/category/:categoryId/bid-data', verifyToken, fetchEventWithPlaceABidData);
router.get('/event/:eventId/bid-data', verifyToken, fetchEventWithAllPlaceABidData);

// Place a Bid
router.post('/place-a-bid', verifyToken, verifyOrganizer, postPlaceABid)
router.get('/place-a-bid', verifyToken, getBids)
router.get('/place-a-bid/:projectId', verifyToken, getBidById)


module.exports = router;