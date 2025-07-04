const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
const { savePaymentSettings,getPaymentSettings,getPaymentSettingById,updatePaymentSetting} = require('../controllers/settings/paymentSettingController')
 
router.post('/savePaymentSettings', verifyToken, savePaymentSettings);
router.get('/getPaymentSetting',verifyToken,getPaymentSettings);
router.get('/getPaymentSetting/:id', verifyToken, getPaymentSettingById);
router.put('/updatePaymentSetting/:id',verifyToken,updatePaymentSetting);
module.exports = router