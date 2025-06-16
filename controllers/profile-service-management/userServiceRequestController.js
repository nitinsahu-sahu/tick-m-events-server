const UserServiceRequest = require('../../models/profile-service-maagement/add-service');
const cloudinary = require('cloudinary').v2;

// Create new user service request
exports.createServiceRequest = async (req, res) => {
    try {
        const { serviceName, location, budget, description } = req.body;
        const { serviceImage } = req.files;
        const myCloud = await cloudinary.uploader.upload(serviceImage.tempFilePath, {
            folder: "service", // Optional: specify a folder in Cloudinary
            width: 150,
            crop: "scale",
        });

        await UserServiceRequest.create({
            serviceName,
            location,
            budget,
            description,
            serviceImage:{
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            },
            createdBy:req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Requested successfully',
        });
    } catch (error) {
        console.error("Create Request Error:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create service request',
            error: error.message
        });
    }
};

// Get all user service requests
exports.getAllServiceRequests = async (req, res) => {
    try {
        const requests = await UserServiceRequest.find().populate("createdBy", "name email");
        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch service requests', error: error.message });
    }
};

// Get single request by ID
exports.getServiceRequestById = async (req, res) => {
    try {
        const request = await UserServiceRequest.findById(req.params.id).populate("createdBy", "name email");
        if (!request) {
            return res.status(404).json({ success: false, message: "Service request not found" });
        }
        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch request', error: error.message });
    }
};

// Delete request
exports.deleteServiceRequest = async (req, res) => {
    try {
        const deleted = await UserServiceRequest.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Service request not found" });
        }
        res.status(200).json({ success: true, message: 'Service request deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete request', error: error.message });
    }
};

exports.updateUserServiceRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedService = await UserServiceRequest.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedService) {
            return res.status(404).json({
                success: false,
                message: 'Service request not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Service request updated successfully',
            data: updatedService,
        });
    } catch (error) {
        console.error("Error updating service request:", error.message);
        res.status(500).json({
            success: false,
            message: 'Server Error',
        });
    }
};