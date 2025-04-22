const express = require('express');
const router = express.Router();
const {createTicketConfiguration} = require("../controllers/event-details/ticketController")


router.route('/:eventId')
  .post(createTicketConfiguration)


module.exports = router;

// .get(getTicket)
// .put(updateTicket)
// .delete(deleteTicket);