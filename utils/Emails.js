const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

exports.sendMail = async (receiverEmail, subject, body) => {
   const htmlContent = await Promise.resolve(body);
  try {
    const mailOptions = {
      from: process.env.EMAIL,
      to: receiverEmail,
      subject: subject,
      html: htmlContent
    };
    // Return the promise directly
    return transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error in sendMail:', error);
    throw error;
  }
};