const express = require('express')
const { getAllUsers, validateUser, blockUser } = require('../controllers/admin/adminController');
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')

router.get('/', verifyToken, getAllUsers);
router.put('/validate/:userId', verifyToken, validateUser);
router.put('/block/:userId', verifyToken, blockUser);

module.exports = router