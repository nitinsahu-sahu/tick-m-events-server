const express = require("express")
const {
    getRequestsByProvider, createRequest, providerRespondOnReq, updateRequestById, sendProposal,
    getPraposal, updatePraposal, getRequestsByOrganizer
} = require("../controllers/event-request/event-requst-controller")
const { verifyToken } = require("../middleware/VerifyToken")
const router = express.Router()

router
    .post("/", verifyToken, createRequest)
    .get("/", verifyToken, getRequestsByProvider)
    .get("/:id/respond", verifyToken, providerRespondOnReq)
    .patch("/:id/select", updateRequestById)
    .post("/:id/propose", sendProposal)
    .get("/:id/getPraposal", getPraposal)
    .patch("/:id/proposal", updatePraposal)
    .get("/organizer-requests", verifyToken, getRequestsByOrganizer)


module.exports = router