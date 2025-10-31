const NotificationTask = require('../../models/marketing-engagement/notification-task');
const UserFcmToken = require('../../models/userReview/UserFcmToken');
const Wishlist = require('../../models/event-details/Wishlist');
const User = require('../../models/User');
const { sendBulkEmails } = require('../../utils/marketing-notification');
const twilio = require('twilio');
const admin = require('../../utils/firebaseAdmin');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

exports.saveNotification = async (req, res) => {
  const {
    eventId,
    message,
    cta,
    notificationType,
    subject,
    isScheduled,
    scheduledAt,
    eventDetails,
    template,
    ctalink,
    group,
    emails,
  } = req.body;
 
  if (!emails || emails.length === 0) {
    console.error('[❌ Error] Recipient list is empty', req.body);
    return res.status(400).json({ error: 'Recipient list is empty' });
  }
 
  // 🔔 Web Push Notification
 
  if (notificationType === 'web-push') {
    if (!emails || emails.length === 0) {
      console.error('[❌ Error] Recipient list is empty', req.body);
      return res.status(400).json({ error: 'Recipient list is empty' });
    }
 
    try {
      const emailList = emails.map((u) => u.email);
      const userTokens = await UserFcmToken.find({ email: { $in: emailList } });
      const fcmTokens = userTokens.map((u) => u.fcmToken).filter(Boolean);
 
      if (fcmTokens.length === 0) {
        return res.status(400).json({ error: 'No FCM tokens found for users' });
      }
 
      const payload = {
        data: {
          title: subject || `Event Notification: ${eventDetails?.name}`,
          body: message,
          cta: cta || 'Open Link',
          ctalink: ctalink || 'https://tick-m.cloud/sign-in',
          eventId: eventId || '',
          emails: emailList.join(','),
          icon: '/icons/icon-192x192.png',
        },
      };
 
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        data: payload.data,
      });
 
      const notification = await NotificationTask.create({
        eventId,
        emails,
        subject,
        message,
        ctalink,
        cta,
        notificationType,
        scheduledAt: new Date(),
        status:
          response.failureCount === 0
            ? 'sent'
            : response.failureCount < fcmTokens.length
              ? 'partial-failure'
              : 'failed',
        fcmResponse: response,
      });
 
      if (response.failureCount > 0) {
        console.warn('[⚠️ FCM Failures]', response.responses.filter((r) => !r.success));
 
        // Optional cleanup
        const failedTokens = [];
        response.responses.forEach((r, i) => {
          if (!r.success && r.error.code === 'messaging/registration-token-not-registered') {
            failedTokens.push(fcmTokens[i]);
          }
        });
        if (failedTokens.length) {
          await UserFcmToken.deleteMany({ fcmToken: { $in: failedTokens } });
          console.log(`[🧹 Removed ${failedTokens.length} invalid tokens]`);
        }
      }
 
      return res.status(200).json({ success: true });
    } catch (pushErr) {
      console.error('[❌ Web Push Error]', pushErr);
      return res
        .status(500)
        .json({ error: 'Failed to send Web Push notification', details: pushErr.message });
    }
  }
 
  // 📆 Scheduled or Immediate Email/SMS
  try {
    if (isScheduled && scheduledAt) {
      console.log('[⏰ Scheduling Notification]');
      const task = await NotificationTask.create({
        eventId,
        emails: emails,
        subject,
        message,
        cta,
        notificationType,
        scheduledAt,
        eventDetails,
        status: 'pending',
      });
      console.log('[📌 Notification Scheduled]', task);
      return res.status(200).json({ success: true, scheduled: true, task });
    } else {
      if (notificationType === 'email') {
        console.log('[📧 Sending Email Notifications]');
        const templateType = group === 'Interested participants (Waitlist but no purchase yet)'
          ? 'interested-participants'
          : 'default';
 
        await sendBulkEmails(emails, subject, message, { text: cta, url: ctalink }, eventDetails, templateType);
        console.log('[✅ Emails sent successfully]');
      } else if (notificationType === 'sms') {
        console.log('[📱 Sending SMS]');
        for (const user of emails) {
          if (user.phone) {
            try {
              console.log(`[📨 Sending SMS to ${user.phone}]`);
              await client.messages.create({
                body: `Event: ${eventDetails?.name || 'No Event Name'}\n${message}\n${cta}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: user.phone,
              });
              console.log(`[✅ SMS sent to ${user.phone}]`);
            } catch (smsErr) {
              console.error(`[❌ SMS Error for ${user.phone}]`, smsErr.message);
            }
          } else {
            console.warn(`[⚠️ Missing phone number for]`, user.email || JSON.stringify(user));
          }
        }
      }
 
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    console.error('[❌ Error Processing Notification]', err);
    return res.status(500).json({ error: 'Failed to send notification', details: err.message });
  }
};

// Save FCM token for a user
exports.saveFcmToken = async (req, res) => {
  const { userId, email, fcmToken } = req.body;

  if (!email || !fcmToken) {
    return res.status(400).json({ error: 'Email and FCM token are required' });
  }

  try {
    const existing = await UserFcmToken.findOne({ email });

    if (existing) {
      existing.fcmToken = fcmToken;
      await existing.save();
    } else {
      await UserFcmToken.create({ userId, email, fcmToken });
    }

    return res.status(200).json({ success: true, message: 'Token saved' });
  } catch (err) {
    console.error('Error saving FCM token:', err);
    return res.status(500).json({ error: 'Failed to save FCM token' });
  }
};

exports.getUserNotifications = async (req, res) => {
  const userEmail = req.query.email;

  if (!userEmail) {
    return res.status(400).json({ error: "Email query param required" });
  }

  try {
    // Fetch notifications for this email that are pending or unread
    const notifications = await NotificationTask.find({
      emails: userEmail,
      status: { $in: ["sent", "pending"] },
    }).sort({ createdAt: -1 });

    res.json({ notifications });
  } catch (err) {
    console.error("[❌ Error fetching notifications]", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

exports.markNotificationRead = async (req, res) => {
  const { notificationId } = req.body;
  try {
    await NotificationTask.findByIdAndUpdate(notificationId, { status: 'read' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// exports.saveNotification =  async (req, res) => {
//   const {
//     eventId,
//     // emails,
//     message,
//     cta,
//     notificationType,
//     subject,
//     isScheduled,
//     scheduledAt
//   } = req.body;

//    const emails = ['pulkitamga0610@gmail.com'];

//   if (!emails || emails.length === 0) {
//     return res.status(400).json({ error: 'Recipient list is empty' });
//   }

//   try {
//     if (isScheduled && scheduledAt) {
//       // Save to DB and use a scheduler like Agenda, Bull, or cron later
//       const task = await NotificationTask.create({
//         eventId,
//         emails,
//         subject,
//         message,
//         cta,
//         notificationType,
//         scheduledAt,
//         status: 'pending',
//       });
//       return res.status(200).json({ success: true, scheduled: true, task });
//     } else {
//       // Immediate send (simplified for now)
//       await sendBulkEmails(emails, subject, message, cta);
//       return res.status(200).json({ success: true });
//     }
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: 'Failed to send notification' });
//   }
// };


