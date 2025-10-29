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

// New middleware to check admin role
exports.verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin privileges required."
        });
    }
    next();
};

// New middleware to check organizer role
exports.verifyOrganizer = (req, res, next) => {
    if (req.user?.role !== 'organizer') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Organizer privileges required."
        });
    }
    next();
};

// New middleware to check provider role
exports.verifyProvider = (req, res, next) => {
    if (req.user?.role !== 'provider') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Provider privileges required."
        });
    }
    next();
};

exports.verifyParticipant = (req, res, next) => {
    if (req.user?.role !== 'participant') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Provider privileges required."
        });
    }
    next();
};

// Grant access to specific roles
// exports.authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         success: false,
//         message: `User role ${req.user.role} is not authorized to access this route`
//       });
//     }
//     next();
//   };
// };
//  authorize('freelancer'), 