const express = require('express')
const { getUserActivities, getAllActivitiesForUser } = require('../controllers/activity/activityController')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
 
router.get('/', getUserActivities)
router.get('/message-notification', verifyToken, getAllActivitiesForUser);
 
module.exports = router