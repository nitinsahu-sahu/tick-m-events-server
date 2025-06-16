const express = require("express")
const { createRequest, providerRespondOnReq, updateRequestById } = require("../controllers/event-request/event-requst-controller")
const { verifyToken } = require("../middleware/VerifyToken")
const router = express.Router()

router
    .post("/",verifyToken, createRequest)
    .get("/:id/respond",verifyToken, providerRespondOnReq)
    .patch("/:id/select", updateRequestById)

module.exports = router