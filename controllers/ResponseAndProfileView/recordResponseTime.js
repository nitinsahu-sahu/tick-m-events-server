const User = require('../../models/User');

// Record response time
exports.recordResponseTime = async (req, res) => {
    try {
        const { responseTime } = req.body; // in milliseconds
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            [
                {
                    $set: {
                        'responseStats.currentMonth.totalResponseTime': {
                            $add: ['$responseStats.currentMonth.totalResponseTime', responseTime]
                        },
                        'responseStats.currentMonth.responseCount': {
                            $add: ['$responseStats.currentMonth.responseCount', 1]
                        },
                        'responseStats.currentMonth.averageResponseTime': {
                            $divide: [
                                { $add: ['$responseStats.currentMonth.totalResponseTime', responseTime] },
                                { $add: ['$responseStats.currentMonth.responseCount', 1] }
                            ]
                        }
                    }
                }
            ],
            { new: true }
        );

        res.status(200).json({ 
            success: true, 
            averageResponseTime: updatedUser?.responseStats.currentMonth.averageResponseTime 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};