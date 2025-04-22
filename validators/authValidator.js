const Joi = require('joi');

exports.signupValidation = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name should have at least 2 characters',
    'any.required': 'Please Enter Your Name',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email',
  }),
  password: Joi.string().min(8).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password should have at least 8 characters',
  }),
  // avatar: Joi.object({
  //   public_id: Joi.string().required().messages({
  //     'string.empty': 'Public ID is required for avatar',
  //   }),
  //   url: Joi.string().uri().required().messages({
  //     'string.empty': 'Avatar URL is required',
  //     'string.uri': 'Avatar URL must be a valid URL',
  //   }),
  // }).required().messages({
  //   'object.base': 'Avatar must be an object with public_id and url',
  //   'any.required': 'Avatar is required',
  // }),

  number: Joi.string().length(10).pattern(/^[0-9]+$/).required().messages({
    'string.empty': 'Phone number is required',
    'string.length': 'Phone number must be exactly 10 digits',
    'string.pattern.base': 'Phone number must contain only digits',
  }),
  gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
  role: Joi.string().valid('organizer', 'admin', 'participant', 'provider').optional(),
});

exports.loginValidation = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please provide a valid email',
  }),
  password: Joi.string().min(8).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password should have at least 8 characters',
  }),
});
