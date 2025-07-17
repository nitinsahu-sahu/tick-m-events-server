const express = require('express');
const router = express.Router();
const { getHomeRecommendationsEvents } = require('../controllers/home-and-recommendataions/home-recommendationn-controller');
const { verifyToken } = require('../middleware/VerifyToken');


router.route('/')
  .get(verifyToken, getHomeRecommendationsEvents)


module.exports = router;