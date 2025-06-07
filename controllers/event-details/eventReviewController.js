const EventReview = require("../../models/event-details/eventReview");
const Event = require("../../models/event-details/Event");
const Rating = require("../../models/event-details/event-rating");
const mongoose = require('mongoose');

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
        const { eventId, ratingValue } = req.body;
        // Validate rating value (1-5 stars)
        if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid rating between 1 and 5"
            });
        }

        // Check if event exists
        const eventExists = await Event.exists({ _id: eventId });
        if (!eventExists) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        // 1. Add the new rating to Rating collection (no user tracking)
        await Rating.create({
            eventId,
            ratingValue
        });

        // 2. Calculate new average and count
        const ratingStats = await Rating.aggregate([
            { $match: { eventId: eventId } },
            {
                $group: {
                    _id: null,
                    average: { $avg: "$ratingValue" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Round the average to nearest whole number
        const roundedAverage = Math.round(ratingStats[0]?.average || 0);
        // 3. Update Event document with new values
        await Event.findByIdAndUpdate(eventId, {
            averageRating: roundedAverage,
            reviewCount: ratingStats[0]?.count || 0
        });

        return res.status(200).json({
            success: true,
            message: "Rating submitted successfully",
            averageRating: ratingStats[0]?.average,
            reviewCount: ratingStats[0]?.count
        });

    } catch (error) {
        console.error("Rating submission error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to submit rating",
            error: error.message
        });
    }
};

