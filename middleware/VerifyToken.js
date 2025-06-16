require('dotenv').config()
const jwt = require('jsonwebtoken')

exports.verifyToken = async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        const token = req.cookies?.token ||
            req.headers?.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required"
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        if (!decoded?._id) {
            return res.status(401).json({
                success: false,
                message: "Invalid token format"
            });
        }

        // Attach user to request
        req.user = decoded;
        next();

    } catch (error) {
        console.error('JWT Error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Session expired, please login again"
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid authentication"
        });
    }
};