const express = require('express');
const router = express.Router();
const { getReviewsByEvent, addReview ,replyToReview,approveReview} = require('../controllers/event-details/eventReviewController');

router
    .get('/:eventId', getReviewsByEvent)
    .post('/', addReview)
    .post('/replay/:reviewId', replyToReview)
    .post('/approve/:reviewId', approveReview)


module.exports = router;