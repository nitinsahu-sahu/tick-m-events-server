const Activity = require('../models/activity/activity.modal');

const logActivity = (activityType, descriptionFn) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user._id) {
        console.log('No user found on req');
        return next();
      }

      console.log(`Logging activity: ${activityType} for user ID ${user._id}`);

      const description = typeof descriptionFn === 'function'
          ? descriptionFn(req)
          : descriptionFn;

      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = '[FILTERED]';
      if (safeBody.newPassword) safeBody.newPassword = '[FILTERED]';
      if (safeBody.confirmPassword) safeBody.confirmPassword = '[FILTERED]';

      const newActivity = await Activity.create({
        userId: user._id,
        activityType,
        description,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: {
          params: req.params,
          body: safeBody,
          query: req.query
        }
      });

      console.log('Activity created:', newActivity);
      next();
    } catch (error) {
      console.error('Activity logger error:', error);
      next();
    }
  };
};

// Common activities - can be used directly in routes
const loginActivity = logActivity('login success', req => `${req.user.email} logged in`);
const logoutActivity = logActivity('logout success', req => `${req.user.email} logged out`);
const eventCreatedActivity = logActivity('event_created', req => `${req.user.email} created event "${req.body.eventName}"`);
const profileUpdatedActivity = logActivity('profile_updated', req => `${req.user.email} updated their profile`);

module.exports = {
    logActivity,
    loginActivity,
    logoutActivity,
    eventCreatedActivity,
    profileUpdatedActivity
};