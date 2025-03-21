const authRoutes = require("../routes/Auth")
const productRoutes = require("../routes/Product")
const orderRoutes = require("../routes/Order")
const cartRoutes = require("../routes/Cart")
const brandRoutes = require("../routes/Brand")
const categoryRoutes = require("../routes/Category")
const userRoutes = require("../routes/User")
const addressRoutes = require('../routes/Address')
const reviewRoutes = require("../routes/Review")
const wishlistRoutes = require("../routes/Wishlist")

// Define route configuration
exports.routesLists = {
    '/api/v1/auth': authRoutes,
    '/api/v1/users': userRoutes,
    '/api/v1/products': productRoutes,
    '/api/v1/order': orderRoutes,
    '/api/v1/cart': cartRoutes,
    '/api/v1/brand': brandRoutes,
    '/api/v1/category': categoryRoutes,
    '/api/v1/address': addressRoutes,
    '/api/v1/review': reviewRoutes,
    '/api/v1/wishlist': wishlistRoutes,
};