const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/VerifyToken')
const { sendEmailOtp, verifyEmail, getVerificationStatus, verifyIdentity, approveIdentity,
    sendWhatsAppOTP, verifyWhatsAppOTP, rejectIdentity, 
    getAllVerifications} = require('../controllers/profile-service-management/verificationController')
const upload = require('../utils/multer');

// User routes
router.post('/send-email-otp', verifyToken, sendEmailOtp);
router.post('/verify-email', verifyToken, verifyEmail);
router.get('/', verifyToken, getVerificationStatus);

// WhatsApp Verification Routes
router.post('/send-whatsapp-otp', verifyToken, sendWhatsAppOTP);
router.post('/verify-whatsapp-otp', verifyToken, verifyWhatsAppOTP);

router.post('/verify-identity', verifyToken, verifyIdentity);

// Admin routes
router.patch('/approve-identity/:userId', verifyToken, approveIdentity);
router.patch('/reject-identity/:userId', verifyToken, rejectIdentity);
router.get('/Idverifications', verifyToken, getAllVerifications);


module.exports = router