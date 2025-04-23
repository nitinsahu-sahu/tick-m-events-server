const Promotion = require('../../models/marketing-engagement/promotion-&-offer.schema');

// Create Promotion
exports.createPromotion = async (req, res) => {
    const {
        discountValue,
        ticketSelection,
        validityPeriodEnd,
        validityPeriodStart,
        promotionType,
        promoCode,
        usageLimit,
        advantageType
    } = req.body;

    try {
        const promotion = new Promotion({
            discountValue,
            ticketSelection,
            validityPeriodEnd,
            validityPeriodStart,
            promotionType: JSON.parse(promotionType), // Parsed version
            promoCode,
            usageLimit,
            advantageType,
            createdBy: req.user?._id || req.body.createdBy
        });

        await promotion.save();
        res.status(201).json({
            success: true,
            message: 'Promotion created successfully',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get All Promotions
exports.getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.find();
        // const promotions = await Promotion.find().populate('createdBy');
        res.status(200).json({ 
            message:"Successfully fetch promotions.",
            success: true, 
            promotions 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Promotion by ID
exports.getPromotionById = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id).populate('createdBy');
        if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found' });
        res.status(200).json({ success: true, data: promotion });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Promotion
exports.updatePromotion = async (req, res) => {
    try {
        const updated = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Promotion not found' });
        res.status(200).json({ success: true, message: 'Promotion updated successfully', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Promotion
exports.deletePromotion = async (req, res) => {
    try {
        const deleted = await Promotion.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Promotion not found' });
        res.status(200).json({ success: true, message: 'Promotion deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
