const express = require('express');
const router = express.Router();
const { getSecureInfo } = require('../controllers/provider/secure-info/secure-info');
const { verifyToken } = require('../middleware/VerifyToken');

// POST /api/subscribe - Subscribe to newsletter
router.get('/info/:placeBidId', verifyToken, getSecureInfo);


module.exports = router;