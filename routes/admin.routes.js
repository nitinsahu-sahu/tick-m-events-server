const express = require('express')
const {getAllUsers} = require('../controllers/admin/adminController');
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
 
router.get('/', verifyToken, getAllUsers);
 
module.exports = router