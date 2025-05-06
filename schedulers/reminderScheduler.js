const cron = require('node-cron');
const ReminderSetting = require('../models/ReminderSetting');
const { sendMail } = require('../utils/Emails');
const moment = require('moment');

// Constants
const CRON_SCHEDULE = '* * * * *'; // Every minute
const TIME_WINDOW_MS = 60 * 1000; // 1 minute window
const MILLISECONDS_PER_MINUTE = 60 * 1000;

// Main scheduler function
async function processReminders() {
  const now = new Date();
  const filterTime = moment(now).format('YYYY-MM-DD hh:mm A');
  console.log(`🔄 Running reminder check at: ${filterTime}`);

  try {
    const pendingReminders = await ReminderSetting.find({
      notificationMethod: 'email',
      sent: false,
      eventDate: { $gt: now } // Only future events
    });

    for (const reminder of pendingReminders) {
      const reminderTimeMs = reminder.reminderTime * MILLISECONDS_PER_MINUTE;
      const targetTime = new Date(reminder.eventDate.getTime() - reminderTimeMs);

      if (Math.abs(now - targetTime) < TIME_WINDOW_MS) {
        await sendReminderEmail(reminder);
        await markReminderAsSent(reminder);
      }
    }
  } catch (err) {
    console.error('❌ Error processing reminders:', err.message);
  }
}

// Helper function to send email
async function sendReminderEmail(reminder) {
  const subject = '⏰ Event Reminder';
  const htmlBody = `
    <h3>Hi there!</h3>
    <p>${reminder.customMessage}</p>
    <p><a href="#">${reminder.ctaButton}</a></p>
  `;

  await sendMail(reminder.recipient, subject, htmlBody);
  console.log(`✅ Reminder sent to ${reminder.recipient}`);
}

// Helper function to update reminder status
async function markReminderAsSent(reminder) {
  reminder.sent = true;
  await reminder.save();
  console.log(`📝 Marked reminder as sent for ${reminder.recipient}`);
}

// Initialize the scheduler
function initReminderScheduler() {
  cron.schedule(CRON_SCHEDULE, processReminders);
  console.log('🟢 Reminder scheduler initialized');
}

module.exports = initReminderScheduler;