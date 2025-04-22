const Joi = require("joi");

exports.ticketTypeValidation = Joi.object({
  eventName: Joi.string().required().messages({
    'string.empty': 'Event Name is required'
  }),
  availableQuantity: Joi.number().integer().min(1).required().messages({
    'number.base': 'Available Quantity must be a number',
    'number.min': 'Minimum quantity is 1',
  }),
  ticketDescription: Joi.string().required().messages({
    'string.empty': 'Ticket Description is required',
  }),
  price: Joi.number().min(0).required().messages({
    'number.base': 'Price must be a number',
    'number.min': 'Price must be a positive value',
  }),
  validity: Joi.date().required().messages({
    'date.base': 'Please provide a valid date for Validity',
  }),
  options: Joi.object({
    transferableTicket: Joi.boolean().optional(),
    personalizedTicket: Joi.boolean().optional(),
    activationCode: Joi.boolean().optional(),
  }).required()
});
