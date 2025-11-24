const Activity = require('../../models/activity/activity.modal');
const Event = require('../../models/event-details/Event');
const { paginate } = require('../../utils/pagination');

exports.getAdminActivities = async (req, res, next) => {
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

exports.getUserActivities = async (req, res, next) => {
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

exports.getAllActivitiesForUser= async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all activities for the user, regardless of type
    const activities = await Activity.find({ userId }).sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      message: 'All activities fetched successfully',
      data: activities,
    });
  } catch (err) {
    console.error('Activity Fetch Error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching activities',
    });
  }
};

exports.getLatestEventCreatedActivity = async (req, res) => {
  try {
    const latestActivity = await Activity.findOne({ activityType: 'event_created' })
      .sort({ timestamp: -1 })
      .populate('userId', 'email name')
      .lean();
 
    if (!latestActivity) {
      return res.status(404).json({
        success: false,
        message: 'No event_created activity found'
      });
    }
    const eventId = latestActivity.metadata?.params?.eventId;
 
    if (eventId) {
      const event = await Event.findById(eventId).select('eventName').lean();
      if (event) {
        latestActivity.eventName = event.eventName; // ✅ Add eventName to response
      }
    }
 
    res.status(200).json({
      success: true,
      message: 'Latest event_created activity fetched successfully',
      data: latestActivity
    });
  } catch (err) {
    console.error('Error fetching latest event_created activity:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest event_created activity'
    });
  }
};