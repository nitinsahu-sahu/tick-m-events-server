const express = require("express")
const promotionController = require("../controllers/marketing-engagement/promotion-&-offer.controller")
const { verifyToken } = require("../middleware/VerifyToken");
const { createSocialMediaPost, getSocialSharePage } = require("../controllers/marketing-engagement/socialMediaController");
const { saveNotification, saveFcmToken, getUserNotifications, markNotificationRead } = require("../controllers/marketing-engagement/notifications");
const router = express.Router()

router
    .post('/', verifyToken, promotionController.createPromotion)
    .get('/', promotionController.getAllPromotions)
    .get('/:id', promotionController.getPromotionById)
    .patch('/:id', promotionController.updatePromotion)
    .delete('/:id', promotionController.deletePromotion)
    .post('/create-post', verifyToken, createSocialMediaPost)
    .get('/social-share/:postId', getSocialSharePage)
    .post('/send-user-notification', saveNotification)
    .post('/save-fcm-token', saveFcmToken)
    .get("/notifications/user", verifyToken, getUserNotifications)
    .post("/mark-notification-read", verifyToken, markNotificationRead);
    
module.exports = router