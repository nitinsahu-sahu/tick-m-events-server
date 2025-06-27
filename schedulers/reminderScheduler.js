const cron = require('node-cron');
const ReminderSetting = require('../models/ReminderSetting');
const Reminder = require('../models/reminder/reminder.model');
const Notification = require('../models/reminder/notification.model');
const { sendMail } = require('../utils/Emails');
const moment = require('moment');

// Constants
const CRON_SCHEDULE = '* * * * *'; // Every minute
const TIME_WINDOW_MS = 60 * 1000; // 1 minute window
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

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

//Notication Cron
async function processInAppReminders() {
  const now = new Date();
  console.log(`🔔 Checking in-app reminders at: ${moment(now).format('YYYY-MM-DD HH:mm:ss')}`);

  try {
    const reminders = await Reminder.find()
      .populate('userId')
      .populate('eventId')
      .lean();

    console.log(`[DEBUG] Total reminders fetched: ${reminders.length}`);

    for (const reminder of reminders) {
      const { reminders: reminderFlags, sentReminders = {}, userId, eventId } = reminder;

      if (!userId) {
        console.log(`[WARN] Skipping reminder ${reminder._id} because userId is missing`);
        continue;
      }
      if (!eventId || !eventId.date || !eventId.time) {
        console.log(`[WARN] Skipping reminder ${reminder._id} because eventId or event date/time is missing`);
        continue;
      }

      const eventDateTimeString = `${eventId.date}T${eventId.time}:00Z`;
      const eventDate = new Date(eventDateTimeString);

      if (isNaN(eventDate)) {
        console.warn(`[WARN] Invalid event date/time for event ${eventId._id}: ${eventId.date} ${eventId.time}`);
        continue;
      }

      const timeDiffHours = (eventDate - now) / MILLISECONDS_PER_HOUR;

      console.log(`[DEBUG] Processing reminder ${reminder._id} for event ${eventId._id}`);
      console.log(`[DEBUG] Event date/time: ${eventDate.toISOString()}, Now: ${now.toISOString()}`);
      console.log(`[DEBUG] Time difference (hours): ${timeDiffHours.toFixed(4)}`);
      console.log(`[DEBUG] Reminder flags: ${JSON.stringify(reminderFlags)}`);
      console.log(`[DEBUG] Sent reminders: ${JSON.stringify(sentReminders)}`);

      const schedule = [
        { label: '1 Week', hours: 168 },
        { label: '3 Days', hours: 72 },
        { label: '3 Hours', hours: 3 },
        { label: '5 Minutes', hours: 0.0833 },
      ];

      for (const { label, hours } of schedule) {
        const alreadySent = sentReminders?.[label];
        const isEnabled = reminderFlags?.[label];

        console.log(`  [DEBUG] Checking schedule "${label}": enabled=${isEnabled}, alreadySent=${alreadySent}`);

        if (!isEnabled || alreadySent) {
          console.log(`  [DEBUG] Skipping "${label}" reminder: ${!isEnabled ? 'not enabled' : 'already sent'}`);
          continue;
        }

        const margin = 0.1; // ~6 minutes window

        if (timeDiffHours >= hours - margin && timeDiffHours <= hours + margin) {
          const message = `Your event is coming up in ${label}.`;
          console.log(`  [INFO] Time difference within margin for "${label}". Creating notification...`);

          await Notification.create({
            userId: userId._id,
            eventId: eventId._id,
            title: `⏰ Reminder for upcoming event`,
            description: message,
          });

          await Reminder.updateOne(
            { _id: reminder._id },
            { $set: { [`sentReminders.${label}`]: true } }
          );

          console.log(`  📲 Sent in-app notification for "${label}" to ${userId.email || userId._id}`);
        } else {
          console.log(`  [DEBUG] Time difference NOT within margin for "${label}".`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error in in-app reminder check:', err.message);
  }
}

// const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

// async function processInAppReminders() {
//   const now = new Date();
//   console.log(`Current server time: ${moment(now).format('YYYY-MM-DD HH:mm:ss')}`);      // Local time
//   console.log(`Current UTC time: ${moment(now).utc().format('YYYY-MM-DD HH:mm:ss')}`);   // UTC time

//   try {
//     const reminders = await Reminder.find().populate('userId').lean();

//     for (const reminder of reminders) {
//       const { reminders: reminderFlags = {}, sentReminders = {}, userId, _id } = reminder;
//       if (!userId) continue;

//       // For testing, eventDate is 5 minutes after "now"
//       const eventDate = new Date(now.getTime() + 5 * 60 * 1000);

//       const timeDiffHours = (eventDate - now) / MILLISECONDS_PER_HOUR;

//       const schedule = [
//         { label: '5 Minutes', hours: 5 / 60 },
//         { label: '3 Hours', hours: 3 },
//         { label: '3 Days', hours: 72 }
//       ];

//       for (const { label, hours } of schedule) {
//         const isEnabled = reminderFlags[label];
//         const alreadySent = sentReminders[label];

//         console.log(`[DEBUG] ID=${_id}, Label=${label}, Enabled=${isEnabled}, Sent=${alreadySent}, DiffHours=${timeDiffHours.toFixed(4)}`);

//         const margin = 0.1; // 6-minute window

//         if (!isEnabled || alreadySent) continue;

//         if (timeDiffHours >= hours - margin && timeDiffHours <= hours + margin) {
//           const message = `Your event is coming up in ${label}.`;

//           try {
//             console.log(`Attempting to create notification for user ${userId._id}, label ${label}`);
//             const notif = await Notification.create({
//               userId: userId._id,
//               title: `⏰ Reminder for upcoming event`,
//               description: message,
//             });
//             console.log('Notification created:', notif);

//             await Reminder.updateOne(
//               { _id },
//               { $set: { [`sentReminders.${label}`]: true } }
//             );

//             console.log(`📲 Sent in-app reminder (${label}) to user ${userId.email || userId._id}`);
//           } catch (createErr) {
//             console.error('Failed to create notification:', createErr);
//           }
//         }
//       }
//     }
//   } catch (err) {
//     console.error('❌ Error in in-app reminder check:', err.message);
//   }
// }



// Initialize the scheduler
// function initReminderScheduler() {
//   cron.schedule(CRON_SCHEDULE, processReminders);
//   console.log('🟢 Reminder scheduler initialized');
// }

function initReminderScheduler() {
  cron.schedule(CRON_SCHEDULE, async () => {
    await processReminders();
    await processInAppReminders();
  });

  console.log('🟢 Reminder scheduler initialized');
}

module.exports = initReminderScheduler;