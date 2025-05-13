const EventReview = require("../../models/event-details/eventReview");

// Add review
exports.addReview = async (req, res) => {
    try {
        const { eventId, name, comment, email } = req.body;

        await EventReview.create({ eventId, name, comment, email });

        res.status(201).json({
            success: true,
            message: "Review added successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

//Organizer approve review
exports.approveReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status } = req.body;

        const review = await EventReview.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        review.status = status;
        await review.save();

        res.status(200).json({
            success: true,
            message: "Review approved successfully",
            data: review
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


// Get all reviews for an event
exports.getReviewsByEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        const reviews = await EventReview.find({ eventId });

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Reply to a review
exports.replyToReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { message } = req.body;

        const review = await EventReview.findById(reviewId);

        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        review.reply = { message };
        await review.save();

        res.status(200).json({ success: true, message: "Reply added", data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};
