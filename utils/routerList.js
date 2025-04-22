const authRoutes = require("../routes/Auth")
const ticketTypeRoutes = require("../routes/ticketTypeRoutes")
const customizationRoutes = require("../routes/customizationRoutes")
const eventRoutes = require("../routes/eventRoutes")
const salesPointRoutes = require("../routes/salesPointRoutes")
const ticketRoutes = require("../routes/ticketRoutes")
const visibilityRoutes = require("../routes/visibilityRoutes")
const promotionOfferRoutes = require("../routes/promotionOfferRoutes")

// Define route configuration
exports.routesLists = {
    '/api/v1/auth': authRoutes,
    '/api/v1/tickets': ticketTypeRoutes,
    '/api/v1/event': eventRoutes,
    // '/api/v1/event': customizationRoutes,
    // '/api/v1/event': organizerRoutes,
    '/api/v1/promotion': promotionOfferRoutes,
    '/api/v1/event/tickets': ticketRoutes,
    // '/api/v1/event': visibilityRoutes
};