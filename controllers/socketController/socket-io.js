const ServiceRequest = require('../../models/service-reequest/service-request');
const cloudinary = require('cloudinary').v2;
const moment = require('moment');
// Create Service Request
exports.updateUserSocket = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { userId },
            { socketId: socket.id },
            { new: true }
        );
        if (!user) {
            console.log('User not found:', userId);
        }
    } catch (err) {
        console.error('Error updating socket ID:', err);
    }
};