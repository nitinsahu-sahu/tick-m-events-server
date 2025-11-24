const Contact = require('../../models/contact/contact')
const { sendMail } = require("../../utils/Emails");
const { createUserConfirmationTemplate,
createAdminNotificationTemplate } = require('../../utils/Emails-template');

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Create new contact
    const newContact = await Contact.create({
      name,
      email,
      message
    });

    // Email templates
    const userEmailHtml = createUserConfirmationTemplate(name);
    const adminEmailHtml = createAdminNotificationTemplate(name, email, message);

    try {
      // Send confirmation email to user
      await sendMail(
        email,
        'Thank You for Contacting Us',
        userEmailHtml
      );

      // Send notification email to admin
      const adminEmail = process.env.EMAIL || 'admin@yourdomain.com';
      await sendMail(
        adminEmail,
        `New Contact Form Submission from ${name}`,
        adminEmailHtml
      );

    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the entire request if email fails, just log it
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us! We have received your message and will get back to you soon.',
      data: newContact
    });

  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form',
      error: error.message
    });
  }
};


