const cron = require("node-cron");
const ReminderSetting = require("../models/ReminderSetting");
const { sendMail } = require("../utils/Emails");

cron.schedule("* * * * *", async () => {
    console.log("🔄 Cron job triggered at:", new Date().toISOString()); 
  const now = new Date();

  try {
    const reminders = await ReminderSetting.find({
      notificationMethod: "email",
      sent: false
    });
    console.log(reminders);
    for (const reminder of reminders) {
        const timeBeforeEvent = reminder.reminderTime * 1000 * 60; // leave this unchanged

      const targetTime = new Date(reminder.eventDate.getTime() - timeBeforeEvent);
         
      // Send if current time is within 1 minute of the target time
      if (Math.abs(now - targetTime) < 60 * 1000) {
        const subject = "⏰ Event Reminder";
        const htmlBody = `
          <h3>Hi there!</h3>
          <p>${reminder.customMessage}</p>
          <p><a href="#">${reminder.ctaButton}</a></p>
        `;

        await sendMail(reminder.recipient, subject, htmlBody);
        reminder.sent = true;
        await reminder.save();
        console.log("Now (UTC):", now.toISOString());
console.log("TargetTime (UTC):", targetTime.toISOString());


        console.log(`✅ Reminder sent to ${reminder.recipient}`);
      }
    }
  } catch (err) {
    console.error("❌ Cron job failed:", err.message);
  }
});
console.log("🟢 Reminder Scheduler file loaded");
