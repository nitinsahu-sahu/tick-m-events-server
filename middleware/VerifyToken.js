require('dotenv').config()
const jwt = require('jsonwebtoken')

// exports.verifyToken = async (req, res, next) => {
//     try {
//         // extract the token from request cookies
//         const { token } = req.cookies || req.headers.authorization.split(' ')[1];

//         // if token is not there, return 401 response
//         if (!token) {
//             return res.status(401).json({ message: "Unauthorized: No token provided" })
//         }

//         // verifies the token 
//         const decodedInfo = jwt.verify(token, process.env.SECRET_KEY)
//         // checks if decoded info contains legit details, then set that info in req.user and calls next
//         if (decodedInfo && decodedInfo._id && decodedInfo.email) {
//             req.user = decodedInfo
//             next()
//         }

//         // if token is invalid then sends the response accordingly
//         else {
//             return res.status(401).json({ message: "Invalid Token, please login again" })
//         }

//     } catch (error) {
//         if (error instanceof jwt.TokenExpiredError) {
//             return res.status(401).json({ message: "Token expired, please login again" });
//         }
//         else if (error instanceof jwt.JsonWebTokenError) {
//             return res.status(401).json({ message: "Invalid Token, please login again" });
//         }
//         else {
//             return res.status(500).json({ message: "Internal Server Error" });
//         }
//     }
// }

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