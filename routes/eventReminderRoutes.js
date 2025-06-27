// routes/reminder.routes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/VerifyToken")
const {setRemindersForEvent,getRemindersForEvent,deleteRemindersForEvent,getAllNotifications,markAllNotificationsAsRead} = require("../controllers/event-reminder/reminderController");

router.get('/notifications', verifyToken, getAllNotifications);
router.put("/:eventId", verifyToken, setRemindersForEvent);
router.put('/notifications/mark-all-read', verifyToken,markAllNotificationsAsRead);
router.get("/:eventId", getRemindersForEvent);
router.delete("/:eventId",deleteRemindersForEvent);

module.exports = router;

