// controllers/activityController.js
import Activity from '../../models/activity/activity.modal.js';
import { paginate } from '../../utils/pagination.js';


export const getUserActivities = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const activities = await paginate(
      Activity.find({ userId: req.user._id })
        .sort({ timestamp: -1 })
        .lean(),
      { page, limit }
    );

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
};

export const getAdminActivities = async (req, res) => {
  try {
    const { page = 1, limit = 10, userId } = req.query;
    const filter = userId ? { userId } : {};
    
    const activities = await paginate(
      Activity.find(filter)
        .populate('userId', 'email name')
        .sort({ timestamp: -1 })
        .lean(),
      { page, limit }
    );

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
};