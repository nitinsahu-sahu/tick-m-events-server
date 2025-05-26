const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/VerifyToken");
const { createReview,getUserReviews, getReview, updateReview, deleteReview, addReply, updateReviewStatus } = require("../controllers/Auth");

// Create a review
router.post("/", verifyToken, createReview);

// // Get all reviews for a specific user
router.get("/user/:userId", getUserReviews);

// // Get a specific review
// router.get("/:id", getReview);

// // Update a review (only by reviewer or admin)
// router.put("/:id", verifyToken, updateReview);

// // Delete a review
// router.delete("/:id", verifyToken, deleteReview);

// // Add/update reply to a review
// router.post("/:id/reply", verifyToken, addReply);

// // Admin routes
// router.patch("/:id/status", verifyToken, updateReviewStatus);

module.exports = router;