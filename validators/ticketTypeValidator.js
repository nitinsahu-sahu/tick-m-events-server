const Joi = require("joi");

exports.ticketTypeValidation = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Ticket Name is required'
  }),
  quantity: Joi.string().required().messages({
    'string.empty': 'Available Quantity is required.',
  }),
  ticketDescription: Joi.string().required().messages({
    'string.empty': 'Ticket Description is required',
  }),
  price: Joi.string().required().messages({
    'string.empty': 'Price  is required',
  }),
  validity: Joi.date().required().messages({
    'date.base': 'Please provide a valid date for Validity',
  })
});
