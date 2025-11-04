// middleware/timezone.js
exports.timezoneMiddleware = (req, res, next) => {
  // Get timezone from client (header, user preference, or default)
  const clientTimezone = req.headers['timezone'] || req.user?.timezone || 'Africa/Douala';
  req.clientTimezone = clientTimezone;
  next();
};
