const express = require('express');
const router = express.Router();
const { getUserEventsWithDetails } = require('../../controllers/organizer/editEvent.Controller');
const { verifyToken } = require('../../middleware/VerifyToken');

router.route('/edit-events')
    .get(verifyToken, getUserEventsWithDetails)
//   .post(verifyToken, createEvent)


module.exports = router;