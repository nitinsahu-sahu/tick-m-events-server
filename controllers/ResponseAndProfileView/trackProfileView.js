const User = require('../../models/User');


// Track profile view (only counts once per viewer)
exports.trackProfileView = async (req, res) => {
    try {
        const profileUserId = req.params.userId;
        const viewerUserId = req.user._id;

        // Don't count if user views their own profile
        if (profileUserId === viewerUserId.toString()) {
            return res.status(200).json({ success: true });
        }

        const updatedUser = await User.findOneAndUpdate(
            {
                _id: profileUserId,
                'profileViews.currentMonth.viewers': { $ne: viewerUserId }
            },
            {
                $inc: { 'profileViews.currentMonth.count': 1 },
                $push: { 'profileViews.currentMonth.viewers': viewerUserId }
            },
            { new: true }
        );

        res.status(200).json({ success: true, views: updatedUser?.profileViews });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};