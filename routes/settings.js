const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
const { savePaymentSettings, getPaymentSettings, deletePaymentSetting, getPaymentSettingById, updatePaymentSetting } = require('../controllers/settings/paymentSettingController')

router.post('/savePaymentSettings', verifyToken, savePaymentSettings);
router.get('/getPaymentSetting', verifyToken, getPaymentSettings);
router.get('/getPaymentSetting/:id', verifyToken, getPaymentSettingById);
router.put('/updatePaymentSetting/:id', verifyToken, updatePaymentSetting);
router.delete('/deletePaymentSetting/:id', verifyToken, deletePaymentSetting);

module.exports = router