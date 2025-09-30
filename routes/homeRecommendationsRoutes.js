const express = require('express');
const router = express.Router();
const { getHomeRecommendationsEvents,getHomeEvents } = require('../controllers/home-and-recommendataions/home-recommendationn-controller');
const { verifyToken } = require('../middleware/VerifyToken');
const { eventListWithOrderAndParticipant } = require('../controllers/marketing-engagement/promotion-&-offer.controller');


router.route('/')
  .get(verifyToken, getHomeRecommendationsEvents)

router.route('/get-home-events').get(getHomeEvents)
router.route('/eventListwithorderandparticipant').get(verifyToken, eventListWithOrderAndParticipant)
module.exports = router;