const express = require('express')
const { getAllUsers, validateUser, blockUser, providerList } = require('../../controllers/admin/adminController');
const router = express.Router()
const { verifyToken, verifyAdmin } = require('../../middleware/VerifyToken');
const { getDashbordData } = require('../../controllers/admin/dashboard.controller');

router.get('/', verifyToken, getAllUsers);
router.put('/validate/:userId', verifyToken, validateUser);
router.put('/block/:userId', verifyToken, blockUser);
router.get('/gogs/pro-list', verifyToken, verifyAdmin, providerList);
router.get('/dashboard', verifyToken, verifyAdmin, getDashbordData);

module.exports = router