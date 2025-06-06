const EventReview = require("../../models/event-details/eventReview");
const Event = require("../../models/event-details/Event");
const Rating = require("../../models/event-details/event-rating");

// Add review
exports.addReview = async (req, res) => {
    try {
        const { eventId, name, comment, email } = req.body;

        await EventReview.create({ eventId, name, comment, email });
        await Event.findByIdAndUpdate(eventId, {
            $inc: { reviewCount: 1 }
        });
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

// Submit or update a rating
exports.submitRating = async (req, res) => {
    try {
        const { eventId, userId, ratingValue } = req.body;

        // Validate rating value (assuming 1-5 scale)
        if (ratingValue < 1 || ratingValue > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // Check if user already rated this event
        let existingRating = await Rating.findOne({ eventId, userId });

        if (existingRating) {
            // Update existing rating
            const oldRatingValue = existingRating.ratingValue;
            existingRating.ratingValue = ratingValue;
            await existingRating.save();

            // Calculate new average
            const totalRatings = await Rating.aggregate([
                { $match: { eventId: mongoose.Types.ObjectId(eventId) } },
                { $group: { _id: null, total: { $sum: "$ratingValue" }, count: { $sum: 1 } } }
            ]);

            if (totalRatings.length > 0) {
                const newAverage = totalRatings[0].total / totalRatings[0].count;
                
                // Update event with new average (count remains the same)
                await Event.findByIdAndUpdate(eventId, {
                    averageRating: newAverage
                });
            }

            return res.status(200).json({
                success: true,
                message: "Rating updated successfully"
            });
        } else {
            // Create new rating
            const newRating = await Rating.create({
                eventId,
                userId,
                ratingValue
            });

            // Calculate new average and count
            const totalRatings = await Rating.aggregate([
                { $match: { eventId } },
                { $group: { _id: null, total: { $sum: "$ratingValue" }, count: { $sum: 1 } } }
            ]);

            if (totalRatings.length > 0) {
                const newAverage = totalRatings[0].total / totalRatings[0].count;
                
                // Update event with new average and increment count
                await Event.findByIdAndUpdate(eventId, {
                    averageRating: newAverage,
                    $inc: { reviewCount: 1 }
                });
            }

            return res.status(201).json({
                success: true,
                message: "Rating submitted successfully"
            });
        }
    } catch (error) {
        console.error("Error submitting rating:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Get average rating for an event
exports.getEventRating = async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId, 'averageRating reviewCount');
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        res.status(200).json({
            success: true,
            averageRating: event.averageRating,
            reviewCount: event.reviewCount
        });
    } catch (error) {
        console.error("Error getting event rating:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
