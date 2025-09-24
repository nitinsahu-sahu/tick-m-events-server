const express = require('express');
const { verifyToken } = require('../middleware/VerifyToken');
const router = express.Router();
const {getUserPoints,getAvailableRewards,getRewardHistory, redeemReward} = require('../controllers/loyalty-program/loyalty-reward-controller');

router.get("/allPoints",verifyToken,getUserPoints);
router.get("/available", verifyToken, getAvailableRewards);
router.get("/history", verifyToken, getRewardHistory);
router.post("/redeemCode",verifyToken,redeemReward);
module.exports = router;