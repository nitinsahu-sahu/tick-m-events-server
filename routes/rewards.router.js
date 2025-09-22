const express = require('express');
const { verifyToken } = require('../middleware/VerifyToken');
const router = express.Router();
const {getUserPoints,getAvailableRewards,getRewardHistory} = require('../controllers/loyalty-program/loyalty-reward-controller');

router.get("/allPoints",verifyToken,getUserPoints);
router.get("/available", verifyToken, getAvailableRewards);
router.get("/history", verifyToken, getRewardHistory);

module.exports = router;