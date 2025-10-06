const express = require('express')
const { getAllUsers, validateUser, blockUser, providerList, getEventSummary } = require('../../controllers/admin/adminController');
const router = express.Router()
const { verifyToken, verifyAdmin } = require('../../middleware/VerifyToken');
const { getDashbordData } = require('../../controllers/admin/dashboard.controller');
const { paymentHistoryController } = require('../../controllers/admin/payment-history.controller');
const { uploadLogo, getLogos, getLogo, updateLogo, deleteLogo } = require('../../controllers/admin/customization/logoController');

router.get('/', verifyToken, getAllUsers);
router.put('/validate/:userId', verifyToken, validateUser);
router.put('/block/:userId', verifyToken, blockUser);
router.get('/gogs/pro-list', verifyToken, verifyAdmin, providerList);
router.post('/verify-admin-fee-payment', verifyToken, paymentHistoryController);
router.get('/dashboard', verifyToken, verifyAdmin, getDashbordData);
router.get('/ticketingActivity', verifyToken, verifyAdmin, getEventSummary);//add routes


// Customization
router.post('/logo-promotion', verifyToken, verifyAdmin, uploadLogo);
router.get('/logo-promotion/', verifyToken, verifyAdmin, getLogos);
router.get('/logo-promotion/:id', verifyToken, verifyAdmin, getLogo);
router.put('/logo-promotion/:id', verifyToken, verifyAdmin, updateLogo);
router.delete('/logo-promotion/:id', verifyToken, verifyAdmin, deleteLogo);

module.exports = router