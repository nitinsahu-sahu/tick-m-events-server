const Availability = require('../../models/profile-service-maagement/Availability-schema');

// Create or update availability
exports.updateAvailability = async (req, res) => {
    try {
        const { availabilityEnabled, days } = req.body;
        const userId = req.user._id; 
        // Find and update or create new availability
        const availability = await Availability.findOneAndUpdate(
            { userId },
            { 
                availabilityEnabled,
                days,
                updatedAt: new Date()
            },
            { 
                new: true,
                upsert: true 
            }
        );

        res.status(200).json({
            success: true,
            message:"Availability Saved...",
            data: availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get availability for a user
exports.getAvailability = async (req, res) => {
    try {
        const userId = req.user._id;
        const availability = await Availability.findOne({ userId });

        if (!availability) {
            return res.status(200).json({
                success: true,
                data: {
                    availabilityEnabled: false,
                    days: days.map(day => ({
                        name: day,
                        available: false,
                        allDay: false,
                        startTime: '09:00',
                        endTime: '17:00'
                    }))
                }
            });
        }

        res.status(200).json({
            success: true,
            data: availability
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};