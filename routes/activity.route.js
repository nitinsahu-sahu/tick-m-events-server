const express = require('express')
const { getUserActivities, getAllActivitiesForUser, getAdminActivities } = require('../controllers/activity/activityController')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
 
router.get('/', getUserActivities)
router.get('/message-notification', verifyToken, getAllActivitiesForUser);
 router.get('/get-all-activies',verifyToken,getAdminActivities);
module.exports = router