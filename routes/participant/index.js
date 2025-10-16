const express = require('express');
const router = express.Router();
const { getOrderasPerEvent } = require('../../controllers/participant/validation-at-entry');
const { verifyToken } = require('../../middleware/VerifyToken');

router.route('/')
    .get(verifyToken, getOrderasPerEvent);

module.exports = router;