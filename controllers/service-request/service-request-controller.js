const ServiceRequest = require('../../models/service-reequest/service-request');
const cloudinary = require('cloudinary').v2;
const moment = require('moment');
// Create Service Request
exports.createServiceRequest = async (req, res) => {
    const { serviceType, dateAndTime, eventLocation, budget, description, additionalOptions, status } = req.body;
    const formattedDateTime = moment(dateAndTime).format('YYYY-MM-DD hh:mm A'); 

    try {
        let coverImageData = {};
        
        // Check if coverImage exists in req.files
        if (req.files && req.files.coverImage) {
            const { coverImage } = req.files;
            // Upload avatar to Cloudinary
            const myCloud = await cloudinary.uploader.upload(coverImage.tempFilePath, {
                folder: "service-request", // Optional: specify a folder in Cloudinary
                width: 150,
                crop: "scale",
            });
            
            coverImageData = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            };
        }

        const service = new ServiceRequest({
            serviceType,
            dateAndTime: formattedDateTime,
            eventLocation,
            budget,
            description,
            additionalOptions,
            status,
            coverImage: coverImageData, // This will be empty object if no image was uploaded
            createdBy: req.user?._id || req.body.createdBy
        });

        const saved = await service.save();
        res.status(201).json({
            success: true,
            message: status === "draft" ? 'Service saved as a draft successfully' : 'Service created successfully',
            data: saved // Optional: you can include the saved document in the response
        });
    } catch (err) {
        res.status(400).json({ 
            success: false,
            error: err.message 
        });
    }
};

// Get All Service Requests
exports.getAllServiceRequests = async (req, res) => {
    try {
        const requests = await ServiceRequest.find().populate('createdBy');
        res.status(200).json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get Single Service Request by ID
exports.getServiceRequestById = async (req, res) => {
    try {
        const request = await ServiceRequest.findById(req.params.id).populate('createdBy');
        if (!request) return res.status(404).json({ error: 'Service request not found' });
        res.status(200).json(request);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update Service Request
exports.updateServiceRequest = async (req, res) => {
    try {
        const updated = await ServiceRequest.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ error: 'Service request not found' });
        res.status(200).json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete Service Request
exports.deleteServiceRequest = async (req, res) => {
    try {
        const deleted = await ServiceRequest.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Service request not found' });
        res.status(200).json({ message: 'Service request deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
