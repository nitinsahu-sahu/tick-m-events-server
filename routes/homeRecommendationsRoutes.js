const express = require('express');
const router = express.Router();
const { getHomeRecommendationsEvents } = require('../controllers/home-and-recommendataions/home-recommendationn-controller');


router.route('/')
  .get(getHomeRecommendationsEvents)


module.exports = router;