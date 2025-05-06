const Wishlist = require('../../models/event-details/Wishlist');

// Add to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user._id; // assuming you're using auth middleware

    const exists = await Wishlist.findOne({ user: userId, event: eventId });
    if (exists) {
      return res.status(400).json({ success: false, message: "Event already in wishlist" });
    }

    const wishlistItem = await Wishlist.create({ user: userId, event: eventId });

    res.status(201).json({ success: true, message: "Added to wishlist", wishlistItem });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};

// Get all wishlist items for a user
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.find({ user: userId }).populate('event', 'eventName date time coverImage');

    res.status(200).json({ success: true, wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.params;

    const deleted = await Wishlist.findOneAndDelete({ user: userId, event: eventId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Event not found in wishlist" });
    }

    res.status(200).json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};
