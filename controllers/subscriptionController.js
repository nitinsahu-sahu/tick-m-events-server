const Subscription = require('../models/Subscription');
const { validationResult } = require('express-validator');

exports.subscribe = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Check if email already exists
    const existingSubscription = await Subscription.findOne({ email: email.toLowerCase() });
    
    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return res.status(409).json({
          success: false,
          message: 'This email is already subscribed to our newsletter'
        });
      } else {
        // Reactivate existing subscription
        existingSubscription.isActive = true;
        await existingSubscription.save();
        
        return res.status(200).json({
          success: true,
          message: 'Successfully resubscribed to our newsletter!'
        });
      }
    }

    // Create new subscription
    const newSubscription = new Subscription({
      email: email.toLowerCase()
    });

    await newSubscription.save();

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to our newsletter!'
    });

  } catch (error) {
    console.error('Subscription error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This email is already subscribed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    const subscription = await Subscription.findOne({ email: email.toLowerCase() });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our subscription list'
      });
    }

    if (!subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This email is already unsubscribed'
      });
    }

    subscription.isActive = false;
    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from our newsletter'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};