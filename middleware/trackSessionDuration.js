const User = require("../models/User");


exports.trackSessionDuration = async (req, res, next) => {
    if (!req.user) return next();
    
    try {
        const user = await User.findById(req.user._id);
        if (!user || !user.lastLoginTime) return next();

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const sessionDuration = calculateDuration(user.lastLoginTime, now);

        // Update today's stats
        if (!user.sessionStats.today || user.sessionStats.today.date !== today) {
            user.sessionStats.today = {
                date: today,
                duration: { hours: 0, minutes: 0, seconds: 0 }
            };
        }
        user.sessionStats.today.duration = addDurations(
            user.sessionStats.today.duration,
            sessionDuration
        );

        // Update total duration
        user.sessionStats.totalDuration = addDurations(
            user.sessionStats.totalDuration || { hours: 0, minutes: 0, seconds: 0 },
            sessionDuration
        );

        // Update history
        const existingDayIndex = user.sessionStats.history.findIndex(
            entry => entry.date === today
        );
        
        if (existingDayIndex >= 0) {
            user.sessionStats.history[existingDayIndex].duration = addDurations(
                user.sessionStats.history[existingDayIndex].duration,
                sessionDuration
            );
        } else {
            user.sessionStats.history.push({
                date: today,
                duration: sessionDuration
            });
        }

        // Update last login time to now for next request
        user.lastLoginTime = now;
        await user.save();
        next();
    } catch (err) {
        console.error("Session tracking error:", err);
        next();
    }
};