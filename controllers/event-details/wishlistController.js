const Wishlist = require('../../models/event-details/Wishlist');

// Add to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user._id; // assuming you're using auth middleware

    const exists = await Wishlist.findOne({ userId, eventId });
    if (exists) {
      return res.status(400).json({ success: false, message: "Event already in wishlist" });
    }

    const wishlistItem = await Wishlist.create({ userId, eventId });

    res.status(201).json({ success: true, message: "Added to wishlist", wishlistItem });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};

// Get all wishlist items for a user with event details
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ userId: req.user._id })
      .populate({
        path: 'eventId',  // The field to populate
        select: 'eventName date time coverImage description', // Fields you want from Event
        model: 'Event'    // The model to populate from
      });

    res.status(200).json({
      success: true,
      wishlist
    });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: err.message
    });
  }
};

// const wishlist = await Wishlist.find({ userId: req.user._id }).populate('event', 'eventName date time coverImage');

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    const deleted = await Wishlist.findOneAndDelete({ userId, eventId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Event not found in wishlist" });
    }

    res.status(200).json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};
