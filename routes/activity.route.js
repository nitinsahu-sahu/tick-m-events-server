const express = require('express')
const { getUserActivities } = require('../controllers/activity/activityController')
const router = express.Router()

router
    .get('/', getUserActivities)


module.exports = router