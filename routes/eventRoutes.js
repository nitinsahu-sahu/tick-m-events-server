const express = require('express');
const router = express.Router();
const { createEvent, getEvents, getEvent, updateEvent, getAllCategories, updateCategory,
  deleteCategory, deleteEvent, addCategory, getCategoryById, updateEventPageCostomization,
  getTodayEvents, getAllServiceCategories, validateViewUpdate, getEventPageCustomization,
  updateEventStatus
} = require('../controllers/event-details/eventController');
const { verifyToken, verifyAdmin } = require('../middleware/VerifyToken');
const { createTicketConfiguration } = require('../controllers/event-details/ticketController');
const { createEventCustomization } = require('../controllers/event-details/customizationController');
const { createPublicationVisibility } = require('../controllers/event-details/visibilityController');
const { submitRating } = require('../controllers/event-details/eventReviewController');
const { validateEventCreation } = require('../validators/event-validator');

router.route('/')
  .get(getEvents)
  .post(verifyToken,validateEventCreation, createEvent)

router.route('/currentDateEvents')
  .get(verifyToken, getTodayEvents)

router.route('/add-category').post(addCategory);

router.route('/allServiceCategory').get(getAllServiceCategories);
router.route('/allCategory').get(getAllCategories);
router.route('/category/:id').get(getCategoryById);
router.route('/category/:id').put(updateCategory);
router.route('/category/:id').delete(deleteCategory);

router.route('/rating').post(submitRating);

router.route('/:id')
  .get(getEvent)
  .patch(updateEvent)
  .delete(deleteEvent);

router.route('/eventPageCustomization/:id')
  .patch(updateEventPageCostomization)

// Event ticket Configuration Routes
router.route('/tickets/:eventId')
  .post(createTicketConfiguration)

// Event Customization Routes
router.route('/tickets/ec/:eventId/:ticketCustomId')
  .post(createEventCustomization)

// Event Customization Routes
router.route('/tickets/pvo/:eventId/:ticketCustomId/:eventCustomizationId')
  .post(verifyToken, createPublicationVisibility)

router.route('/:id/validation-view').patch(validateViewUpdate);

router.get('/eventPageCustomization/:id', getEventPageCustomization);

router.put('/status/:eventId/:status', verifyToken, verifyAdmin, updateEventStatus);

module.exports = router;