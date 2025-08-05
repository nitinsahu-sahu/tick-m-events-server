// validation/eventValidation.js
const { body, validationResult } = require('express-validator');

exports.validateEventCreation = [
  body('eventName').notEmpty().withMessage('Event name is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('time').notEmpty().withMessage('Time is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('eventType').notEmpty().withMessage('Event type is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('format').notEmpty().withMessage('Format is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('name').notEmpty().withMessage('Organizer name is required'),
  body('number').notEmpty().withMessage('Organizer number is required'),
  body('email').isEmail().withMessage('Valid organizer email is required'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    next();
  }
];