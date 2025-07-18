const express = require('express');
const router = express.Router();
 
const { submitContactForm } = require('../controllers/contact/contactController');
 
// Send a new message
router.post('/', submitContactForm);
 
module.exports = router;