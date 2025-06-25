const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/VerifyToken');
const { updateAvailability, getAvailability } = require('../controllers/profile-service-management/AvailabilityController');

router.route('/')
    .post(verifyToken, updateAvailability)
    .get(verifyToken, getAvailability);

module.exports = router;