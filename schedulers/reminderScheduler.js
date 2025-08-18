const cron = require('node-cron');
const ReminderSetting = require('../models/ReminderSetting');
const Reminder = require('../models/reminder/reminder.model');
const Notification = require('../models/reminder/notification.model');
const NotificationTask = require('../models/marketing-engagement/notification-task');
const { sendMail } = require('../utils/Emails');
const { sendBulkEmails } = require('../utils/marketing-notification');
const User = require('../models/User');
const twilio = require('twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const moment = require('moment');
const Activity = require('../models/activity/activity.modal');
const UserFcmToken = require('../models/userReview/UserFcmToken');

// Constants
const CRON_SCHEDULE = '* * * * *'; // Every minute
const TIME_WINDOW_MS = 60 * 1000; // 1 minute window
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

// Main scheduler function
async function processReminders() {
  const now = new Date();
  const filterTime = moment(now).format('YYYY-MM-DD hh:mm A');
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
}

// Helper function to update reminder status
async function markReminderAsSent(reminder) {
  reminder.sent = true;
  await reminder.save();
}

//Notication Cron
async function processInAppReminders() {
  const now = new Date();
  try {
    const reminders = await Reminder.find()
      .populate('userId')
      .populate('eventId')
      .lean();

    for (const reminder of reminders) {
      const { reminders: reminderFlags, sentReminders = {}, userId, eventId } = reminder;

      if (!userId) {
        continue;
      }
      if (!eventId || !eventId.date || !eventId.time) {
        continue;
      }

      const eventDateTimeString = `${eventId.date}T${eventId.time}:00Z`;
      const eventDate = new Date(eventDateTimeString);

      if (isNaN(eventDate)) {
        continue;
      }

      const timeDiffHours = (eventDate - now) / MILLISECONDS_PER_HOUR;

      const schedule = [
        { label: '1 Week', hours: 168 },
        { label: '3 Days', hours: 72 },
        { label: '3 Hours', hours: 3 },
        { label: '5 Minutes', hours: 0.0833 },
      ];

      for (const { label, hours } of schedule) {
        const alreadySent = sentReminders?.[label];
        const isEnabled = reminderFlags?.[label];

        if (!isEnabled || alreadySent) {
          continue;
        }

        const margin = 0.1; // ~6 minutes window

        if (timeDiffHours >= hours - margin && timeDiffHours <= hours + margin) {
          const message = `Your event is coming up in ${label}.`;
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
        } else {
          console.log(`  [DEBUG] Time difference NOT within margin for "${label}".`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error in in-app reminder check:', err.message);
  }
}

//For SMS,EMAIL & WEB notification
 
const sendSms = async (to, message) => {
  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
  } catch (err) {
    console.error(`[❌ SMS Error for ${to}]`, err.message);
  }
};
 
const sendWebPush = async (users, subject, message, cta, eventId) => {
  const emailList = users.map((u) => u.email);
  const userTokens = await UserFcmToken.find({ email: { $in: emailList } });
  const fcmTokens = userTokens.map((u) => u.fcmToken).filter(Boolean);
 
  if (fcmTokens.length === 0) {
    console.warn('[⚠️ Web Push] No FCM tokens found');
    return;
  }
 
  const payload = {
    data: {
      title: subject || 'Event Notification',
      body: message,
      cta: cta || '',
      eventId: eventId || '',
      emails: emailList.join(','),
    },
  };
 
  await admin.messaging().sendEachForMulticast({
    tokens: fcmTokens,
    data: payload.data,
  });
 
};
 
const processScheduledNotifications = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - TIME_WINDOW_MS);
  const windowEnd = new Date(now.getTime() + TIME_WINDOW_MS);
 
  try {
    const notifications = await NotificationTask.find({
      status: 'pending',
      scheduledAt: { $gte: windowStart, $lte: windowEnd },
    });
 
    for (const notification of notifications) {
      const { notificationType, emails = [], subject, message, cta, eventId, eventDetails } = notification;
 
      try {
        switch (notificationType) {
          case 'email':
            await sendBulkEmails(
              emails,
              subject,
              message,
              { text: cta },
              eventDetails || {
                name: subject || 'Event',
                date: new Date(),
                location: 'Online',
              },
              'default'
            );
            break;
 
          case 'sms':
            for (const phone of notification.phones || []) {
              await sendSms(phone, `${message} ${cta || ''}`);
            }
            break;
 
          case 'web-push':
            await sendWebPush(emails, subject, message, cta, eventId);
            break;
 
          default:
            throw new Error(`Unknown notificationType: ${notificationType}`);
        }
 
        notification.status = 'sent';
      } catch (err) {
        notification.status = 'failed';
      }
 
      notification.updatedAt = new Date();
      await notification.save();
    }
  } catch (err) {
    console.error('❌ Error processing scheduled notifications:', err.message);
  }
};

 // Cleanup old activity logs older than 60 days
async function cleanupOldActivities() {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
 
    const result = await Activity.deleteMany({
      timestamp: { $lt: sixtyDaysAgo }
    });
 
  } catch (err) {
    console.error("[❌ CRON] Error deleting old activities:", err.message);
  }
}

function initReminderScheduler() {
  cron.schedule(CRON_SCHEDULE, async () => {
    await processReminders();
    await processInAppReminders();
    await processScheduledNotifications();
    await cleanupOldActivities();
  });
 
  console.log('🟢 Reminder scheduler initialized');
}

module.exports = initReminderScheduler;