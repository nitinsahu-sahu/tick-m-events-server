const express = require('express');
const router = express.Router();
const { getUserEventsWithDetails,deleteEvent,updateEvents } = require('../../controllers/organizer/editEvent.Controller');
const { verifyToken } = require('../../middleware/VerifyToken');

router.route('/edit-events')
    .get(verifyToken, getUserEventsWithDetails)

router.delete('/edit-events/:eventId',verifyToken, deleteEvent);
router.patch('/edit-events/:eventId',verifyToken, updateEvents);


module.exports = router;