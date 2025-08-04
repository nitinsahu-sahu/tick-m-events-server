const User = require("../models/User");


// Add this middleware to track session duration
exports.trackSessionDuration = async (req, res, next) => {
    if (!req.user) return next();
    
    try {
        const user = await User.findById(req.user._id);
        if (!user || !user.lastLoginTime) return next();

        const now = new Date();
        const today = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
        const sessionDurationHours = (now - user.lastLoginTime) / (1000 * 60 * 60); // Convert ms to hours

        // Update today's stats
        if (!user.sessionStats.today.date || user.sessionStats.today.date !== today) {
            user.sessionStats.today = { date: today, hours: 0 };
        }
        user.sessionStats.today.hours += sessionDurationHours;

        // Update total hours
        user.sessionStats.totalHours += sessionDurationHours;

        // Update history
        const existingDayIndex = user.sessionStats.history.findIndex(
            entry => entry.date === today
        );
        
        if (existingDayIndex >= 0) {
            user.sessionStats.history[existingDayIndex].hours += sessionDurationHours;
        } else {
            user.sessionStats.history.push({
                date: today,
                hours: sessionDurationHours
            });
        }

        await user.save();
        next();
    } catch (err) {
        console.error("Session tracking error:", err);
        next();
    }
};