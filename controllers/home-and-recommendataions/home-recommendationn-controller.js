const cloudinary = require('cloudinary').v2;
const Event = require('../../models/event-details/Event');
const Category = require('../../models/event-details/Category');
const Organizer = require('../../models/event-details/Organizer');
const Customization = require('../../models/event-details/Customization');
const Ticket = require('../../models/event-details/Ticket');
const Visibility = require('../../models/event-details/Visibility');
const eventReview = require('../../models/event-details/eventReview');

exports.getHomeRecommendationsEvents = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const userId = req.user?._id; // Assuming user is authenticated and user data is in req.user
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed in JS
        const currentDateTime = new Date(); // Gets current date AND time

        // 1. Get upcoming events (events with date in future)
        const upcomingEvents = await Event.find({
            isDelete: { $ne: true },
            createdBy: userId,
            status: "approved",
            $or: [
                {
                    date: { $gt: currentDateTime.toISOString().split('T')[0] } // Date is in future
                },
                {
                    date: currentDateTime.toISOString().split('T')[0], // Date is today
                    time: {
                        $gt: currentDateTime.toLocaleTimeString('en-US',
                            { hour12: false }
                        )
                    } // But time is in future
                }
            ]
        })
            .sort({ date: 1 }) // Sort by date ascending (earliest first)
            .limit(10) // Limit to 10 upcoming events
            .lean();



        // 2. Get popular trending events
        const popularEvents = await Event.aggregate([
            {
                $match: {
                    isDelete: { $ne: true },
                    status: "approved",

                }
            },
            {
                $lookup: {
                    from: "tickets",
                    localField: "_id",
                    foreignField: "eventId",
                    as: "ticketData"
                }
            },
            {
                $lookup: {
                    from: "eventreviews", // assuming your review collection name
                    localField: "_id",
                    foreignField: "eventId",
                    as: "reviews"
                }
            },
            {
                $addFields: {
                    // Calculate popularity score based on tickets and ratings
                    popularityScore: {
                        $add: [
                            { $sum: "$ticketData.tickets.totalTickets" }, // ticket sales
                            { $multiply: [{ $size: "$reviews" }, 5] }, // number of reviews
                            { $ifNull: [{ $avg: "$reviews.rating" }, 0] } // average rating
                        ]
                    }
                }
            },
            { $sort: { popularityScore: -1 } }, // Sort by popularity descending
            { $limit: 10 }, // Limit to 10 popular events
            {
                $project: {
                    ticketData: 0,
                    reviews: 0
                }
            }
        ]);

        // 3. Get personalized recommendations (if user is logged in)
        let recommendedEvents = [];
        if (userId) {
            // Get user's past event preferences (categories they've interacted with)
            const userPreferences = await getEventPreferences(userId);

            if (userPreferences && userPreferences.length > 0) {
                recommendedEvents = await Event.aggregate([
                    {
                        $match: {
                            isDelete: { $ne: true },
                            date: { $gte: currentDate.toISOString().split('T')[0] },
                            categoryId: { $in: userPreferences }
                        }
                    },
                    {
                        $lookup: {
                            from: "eventreviews",
                            localField: "_id",
                            foreignField: "eventId",
                            as: "reviews"
                        }
                    },
                    {
                        $addFields: {
                            avgRating: { $avg: "$reviews.rating" },
                            reviewCount: { $size: "$reviews" }
                        }
                    },
                    {
                        $sort: {
                            avgRating: -1,
                            reviewCount: -1,
                            date: 1
                        }
                    },
                    { $limit: 10 },
                    { $project: { reviews: 0 } }
                ]);
            }
        }

        // If no personalized recommendations, fall back to recently added events
        if (recommendedEvents.length === 0) {
            recommendedEvents = await Event.find({
                isDelete: { $ne: true },
            status:"approved",
                date: { $gte: currentDate.toISOString().split('T')[0] }
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
        }

        // Helper function to get full event details
        const getEventDetails = async (events) => {
            return Promise.all(events.map(async (event) => {
                const [organizer, customization, tickets, visibility, category] = await Promise.all([
                    Organizer.findOne({ eventId: event._id }).select('-socialMedia -website -createdAt -updatedAt -isDelete -__v').lean(),
                    Customization.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                    Ticket.find({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                    Visibility.findOne({ eventId: event._id }).select('-createdAt -updatedAt -isDelete -__v').lean(),
                    Category.findById(event.categoryId).select('name').lean()
                ]);

                return {
                    ...event,
                    organizer,
                    customization,
                    tickets,
                    visibility,
                    category: category?.name || 'General'
                };
            }));
        };

        //4. Find events within this month
        const currentDateFormatted = currentDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
        const currentTimeFormatted = currentDate.toTimeString().substring(0, 5); // "HH:mm"

        // Find events within this month
        const currentMonthFormatted = String(currentMonth).padStart(2, '0');
        const currentMonthEvents = await Event.find({
            date: { $regex: `^${currentYear}-${currentMonthFormatted}` },
            isDelete: false,
            createdBy: userId,
        });

        // Filter events that are either:
        // 1. In the future (date after today), OR
        // 2. Today but time hasn't passed yet
        const filteredEvents = currentMonthEvents.filter(event => {
            const eventDate = event.date;
            const eventTime = event.time;

            // If event date is in the future
            if (eventDate > currentDateFormatted) {
                return true;
            }
            // If event date is today and time hasn't passed
            if (eventDate === currentDateFormatted && eventTime >= currentTimeFormatted) {
                return true;
            }
            // Otherwise exclude
            return false;
        });

        // Sort events by date then time (ascending)
        filteredEvents.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.time.localeCompare(b.time);
        });

        const upcomingWithDetails = await getEventDetails(upcomingEvents);
        const popularWithDetails = await getEventDetails(popularEvents);
        const recommendedWithDetails = await getEventDetails(recommendedEvents);

        res.status(200).json({
            success: true,
            message: "Events fetched successfully",
            upcomingEvents: upcomingWithDetails,
            popularEvents: popularWithDetails,
            recommendedEvents: recommendedWithDetails,
            latestEvents: filteredEvents
        });

    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Helper function to get user's preferred event categories
async function getEventPreferences(userId) {
    try {
        // Get categories from events the user has attended, booked, or shown interest in
        const preferences = await Event.aggregate([
            {
                $lookup: {
                    from: "tickets", // or bookings/interest collection
                    localField: "_id",
                    foreignField: "eventId",
                    as: "userInteractions"
                }
            },
            {
                $match: {
                    "userInteractions.userId": userId
                }
            },
            {
                $group: {
                    _id: "$categoryId",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 3 // top 3 categories
            }
        ]);

        return preferences.map(pref => pref._id);
    } catch (error) {
        console.error("Error fetching user preferences:", error);
        return [];
    }
}