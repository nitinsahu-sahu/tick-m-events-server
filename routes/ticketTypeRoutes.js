const express = require("express");
const validate = require("../middleware/validateRequest");
const { createTicketType, fetchTicketType, updateTicketType, updateRefundPolicy } = require("../controllers/TicketType");
const { verifyToken } = require("../middleware/VerifyToken");
const router = express.Router();


router.route('/')
    .get(verifyToken, fetchTicketType)
    .post(verifyToken, createTicketType)

router.route('/:id')
    .patch(verifyToken, updateTicketType)
//   .delete(deleteEvent);

router.route('/refund-policy/:eventId').patch(verifyToken, updateRefundPolicy);
module.exports = router;
