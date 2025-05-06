const express = require("express")
const promotionController = require("../controllers/marketing-engagement/promotion-&-offer.controller")
const { verifyToken } = require("../middleware/VerifyToken")
const router = express.Router()

router
    .post('/', verifyToken, promotionController.createPromotion)
    .get('/', promotionController.getAllPromotions)
    .get('/:id', promotionController.getPromotionById)
    .patch('/:id', promotionController.updatePromotion)
    .delete('/:id', promotionController.deletePromotion)
module.exports = router