const express = require("express")
const {
    getRequestsByProvider, createRequest, providerRespondOnReq, updateRequestById, sendProposal,
    getPraposal, updatePraposal, getRequestsByOrganizer,
    updateRequestStatusByOrganizer,
    markRequestAsCompleted,
    cancelEventReq,
    getProviderAcceptedReq
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
    .get("/acceptedByProvider", verifyToken, getProviderAcceptedReq)
    .put("/:id/status", verifyToken, updateRequestStatusByOrganizer)
    .patch('/mark-completed/:id', markRequestAsCompleted)
    .delete('/:id',verifyToken, cancelEventReq);

module.exports = router