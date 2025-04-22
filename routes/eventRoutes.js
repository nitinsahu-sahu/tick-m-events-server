const express = require('express');
const router = express.Router();
const { createEvent, getEvents, getEvent, updateEvent, deleteEvent } = require('../controllers/event-details/eventController');
const { verifyToken } = require('../middleware/VerifyToken');

router.route('/')
  .get(getEvents)
  .post(verifyToken, createEvent);

router.route('/:id')
  .get(getEvent)
  .put(updateEvent)
  .delete(deleteEvent);

module.exports = router;