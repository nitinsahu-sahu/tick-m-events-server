const express = require("express")
const promotionController = require("../controllers/marketing-engagement/promotion-&-offer.controller")
const { verifyToken } = require("../middleware/VerifyToken");
const { createSocialMediaPost, getSocialSharePage } = require("../controllers/marketing-engagement/socialMediaController");
const router = express.Router()

router
    .post('/', verifyToken, promotionController.createPromotion)
    .get('/', promotionController.getAllPromotions)
    .get('/:id', promotionController.getPromotionById)
    .patch('/:id', promotionController.updatePromotion)
    .delete('/:id', promotionController.deletePromotion)
    .post('/create-post', verifyToken, createSocialMediaPost)
    .get('/social-share/:postId', getSocialSharePage);
module.exports = router