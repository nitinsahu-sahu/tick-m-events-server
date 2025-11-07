const express = require('express')
const { getAllUsers, validateUser, blockUser, providerList, getEventSummary } = require('../../controllers/admin/adminController');
const router = express.Router()
const { verifyToken, verifyAdmin } = require('../../middleware/VerifyToken');
const { getDashbordData,getMoniteringProvider,getProviderList } = require('../../controllers/admin/dashboard.controller');
const { paymentHistoryController } = require('../../controllers/admin/payment-history.controller');
const { uploadLogo, getLogos, getLogo, updateLogo, deleteLogo } = require('../../controllers/admin/customization/logoController');
const { getAllAdminTransactions, getFinancialStatistics } = require('../../controllers/admin/ticketAndTransectionSupervision/verify-tran');

router.get('/', verifyToken, getAllUsers);
router.put('/validate/:userId', verifyToken, validateUser);
router.put('/block/:userId', verifyToken, blockUser);
router.get('/gogs/pro-list', verifyToken, verifyAdmin, providerList);
router.post('/verify-admin-fee-payment', verifyToken, paymentHistoryController);
router.get('/admin-payments', verifyToken, getAllAdminTransactions);
router.get('/dashboard', verifyToken, verifyAdmin, getDashbordData);
router.get('/ticket-trnsa', verifyToken, verifyAdmin, getFinancialStatistics);
router.get('/monitering-providers/:providerId', verifyToken, verifyAdmin, getMoniteringProvider);
router.get('/role-providers', verifyToken, verifyAdmin, getProviderList);
router.get('/ticketingActivity', verifyToken, verifyAdmin, getEventSummary);//add routes

// router.get("/check", (req, res) => {
//   const now = new Date();
//   res.json({
//     msg: "Testing timezone middleware in payment route",
//     currentTime: now
//   });
// });

// Customization
router.post('/logo-promotion', verifyToken, verifyAdmin, uploadLogo);
router.get('/logo-promotion/',  getLogos);
router.get('/logo-promotion/:id', verifyToken, verifyAdmin, getLogo);
router.put('/logo-promotion/:id', verifyToken, verifyAdmin, updateLogo);
router.delete('/logo-promotion/:id', verifyToken, verifyAdmin, deleteLogo);

module.exports = router