const express = require('express');
const router = express.Router();
const { saveReminderSettings } = require('../controllers/reminderController');

router.post('/', saveReminderSettings);

module.exports = router;
