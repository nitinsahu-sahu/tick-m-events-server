const express = require('express')
const { getUserActivities, getAllActivitiesForUser, getAdminActivities,getLatestEventCreatedActivity } = require('../controllers/activity/activityController')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')

router.get('/', getUserActivities)
router.get('/message-notification', verifyToken, getAllActivitiesForUser);
router.get('/get-all-activies', verifyToken, getAdminActivities);
router.get('/event-created/latest', verifyToken, getLatestEventCreatedActivity);
module.exports = router