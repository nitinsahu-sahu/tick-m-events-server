const authRoutes = require("../routes/Auth")
const ticketTypeRoutes = require("../routes/ticketTypeRoutes")
const eventRoutes = require("../routes/eventRoutes")
const eventWishlistRoutes = require("../routes/wishlistRoute")
const promotionOfferRoutes = require("../routes/promotionOfferRoutes")
const serviceRequestRoutes = require("../routes/serviceRequestRoutes")
const userServiceRequestRoutes = require("../routes/userServiceRequestRoutes")
const reminderRoutes = require("../routes/reminders")
const eventReviewRoutes = require("../routes/eventReviewRoute")
const eventOrderRoutes = require("../routes/eventOrderRoute")

// Define route configuration
exports.routesLists = {
    '/api/v1/auth': authRoutes,
    '/api/v1/tickets': ticketTypeRoutes,
    '/api/v1/event': eventRoutes,
    '/api/v1/event-wishlist': eventWishlistRoutes,
    '/api/v1/event-review': eventReviewRoutes,
    '/api/v1/service-request': serviceRequestRoutes,
    '/api/v1/user-service-request': userServiceRequestRoutes,
    '/api/v1/reminder': reminderRoutes,
    '/api/v1/promotion': promotionOfferRoutes,
    '/api/v1/event-order': eventOrderRoutes,
};