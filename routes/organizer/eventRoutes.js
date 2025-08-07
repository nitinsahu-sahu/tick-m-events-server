const express = require('express');
const router = express.Router();
const { getUserEventsWithDetails, deleteEvent, updateEvents, updateEventVisibility } = require('../../controllers/organizer/editEvent.Controller');
const { verifyToken } = require('../../middleware/VerifyToken');
const { fetchEventOrganizerSelect } = require('../../controllers/organizer/common-event-select');

router.route('/edit-events')
    .get(verifyToken, getUserEventsWithDetails)

router.delete('/edit-events/:eventId', verifyToken, deleteEvent);
router.patch('/edit-events/:eventId', verifyToken, updateEvents);
router.patch('/edit-event-visibility/:eventId', verifyToken, updateEventVisibility);
router.get('/event-com', verifyToken, fetchEventOrganizerSelect);


module.exports = router;