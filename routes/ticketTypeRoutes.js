const express = require("express");
const validate = require("../middleware/validateRequest");
const { ticketTypeValidation } = require("../validators/ticketTypeValidator");
const { createTicketType } = require("../controllers/TicketType");
const { verifyToken } = require("../middleware/VerifyToken");
const router = express.Router();

router.post("/create-ticket", verifyToken, validate(ticketTypeValidation), createTicketType);

module.exports = router;
