const express = require("express");
const validate = require("../middleware/validateRequest");
const { ticketTypeValidation } = require("../validators/ticketTypeValidator");
const { createTicketType, fetchTicketType, updateTicketType } = require("../controllers/TicketType");
const { verifyToken } = require("../middleware/VerifyToken");
const router = express.Router();


router.route('/')
    .get(verifyToken, fetchTicketType)
    .post(verifyToken, createTicketType)

router.route('/:id')
    .patch(verifyToken, updateTicketType)
//   .delete(deleteEvent);

module.exports = router;
