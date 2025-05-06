const express = require('express');
const router = express.Router();
const { createEvent, getEvents, getEvent, updateEvent, deleteEvent } = require('../controllers/event-details/eventController');
const { verifyToken } = require('../middleware/VerifyToken');
const { createTicketConfiguration } = require('../controllers/event-details/ticketController');
const { createEventCustomization } = require('../controllers/event-details/customizationController');
const { createPublicationVisibility } = require('../controllers/event-details/visibilityController');

router.route('/')
  .get(getEvents)
  .post(verifyToken, createEvent)

router.route('/:id')
  .get(getEvent)
  .patch(updateEvent)
  .delete(deleteEvent);

// Event ticket Configuration Routes
router.route('/tickets/:eventId')
  .post(createTicketConfiguration)

// Event Customization Routes
router.route('/tickets/ec/:eventId/:ticketCustomId')
  .post(createEventCustomization)

// Event Customization Routes
router.route('/tickets/pvo/:eventId/:ticketCustomId/:eventCustomizationId')
  .post(createPublicationVisibility)

module.exports = router;