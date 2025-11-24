const cron = require('node-cron');
const User = require('../models/User');

const archiveAndResetStats = async () => {
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    try {
        // Archive and reset response stats
        await User.updateMany(
            { 'responseStats.currentMonth.responseCount': { $gt: 0 } },
            [
                {
                    $set: {
                        'responseStats.history': {
                            $concatArrays: [
                                '$responseStats.history',
                                [{
                                    month: currentMonth,
                                    averageResponseTime: '$responseStats.currentMonth.averageResponseTime'
                                }]
                            ]
                        },
                        'responseStats.currentMonth': {
                            totalResponseTime: 0,
                            responseCount: 0,
                            averageResponseTime: 0
                        }
                    }
                }
            ]
        );

        // Archive and reset profile views
        await User.updateMany(
            { 'profileViews.currentMonth.count': { $gt: 0 } },
            [
                {
                    $set: {
                        'profileViews.history': {
                            $concatArrays: [
                                '$profileViews.history',
                                [{
                                    month: currentMonth,
                                    count: '$profileViews.currentMonth.count'
                                }]
                            ]
                        },
                        'profileViews.currentMonth': {
                            count: 0,
                            viewers: []
                        }
                    }
                }
            ]
        );

    } catch (error) {
        console.error('Error in monthly stats reset:', error);
    }
};

// Schedule to run at midnight on the 1st of every month
cron.schedule('0 0 1 * *', archiveAndResetStats);

module.exports = archiveAndResetStats;