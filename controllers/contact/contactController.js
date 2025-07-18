const Contact = require('../../models/contact/contact')
 
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
 
    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us!',
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