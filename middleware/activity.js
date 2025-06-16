// middleware/activityLogger.js
const Activity = require('../models/activity/activity.modal');

const logActivity = (activityType, descriptionFn) => {
    return async (req, res, next) => {
        try {
            // if (!req.user) return next();

            const description = typeof descriptionFn === 'function'
                ? descriptionFn(req)
                : descriptionFn;
            console.log('description',description);

            const data = await Activity.create({
                userId: req.user._id,
                activityType,
                description,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                metadata: {
                    params: req.params,
                    body: req.body,
                    query: req.query
                }
            });
            console.log(data);

            // next();
        } catch (error) {
            next();
        }
    };
};

// Common activities
const loginActivity = logActivity('login', req => `${req.user.email} logged in`);
const logoutActivity = logActivity('logout', req => `${req.user.email} logged out`);
const eventCreatedActivity = logActivity('event_created', req => `${req.user.email} created event "${req.body.eventName}"`);

module.exports = {
    logActivity,
    loginActivity,
    logoutActivity,
    eventCreatedActivity
};