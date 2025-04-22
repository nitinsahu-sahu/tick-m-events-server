const express = require('express');
const router = express.Router();
const {
  createVisibility,
  getVisibility,
  updateVisibility,
  deleteVisibility
} = require('../controllers/event-details/visibilityController');

router.route('/:eventId/visibility')
  .post( createVisibility)
  .get(getVisibility)
  .put( updateVisibility)
  .delete( deleteVisibility);

module.exports = router;