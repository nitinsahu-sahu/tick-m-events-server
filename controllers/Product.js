const { Schema, default: mongoose } = require("mongoose")
const Product = require("../models/Product")

exports.create = async (req, res) => {
    try {
        const created = new Product(req.body)
        await created.save()
        res.status(201).json(created)
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: 'Error adding product, please trying again later' })
    }
}

exports.getAll = async (req, res) => {
    try {
        const filter = {};
        const { category, priceRange, rating, page, limit } = req.query;

        // Category filter
        if (category && category !== 'all') {
            filter.category = { $in: category };
        }

        // Price range filter
        if (priceRange) {
            switch (priceRange) {
                case 'below':
                    filter.price = { $lt: 500 };
                    break;
                case 'between':
                    filter.price = { $gte: 501, $lte: 2000 };
                    break;
                case 'above':
                    filter.price = { $gt: 2001 };
                    break;
            }
        }

        // Rating filter
        if (rating) {
            const ratingRanges = {
                'up1Star': { $gte: 0.1, $lte: 1 },
                'up2Star': { $gte: 1.1, $lte: 2 },
                'up3Star': { $gte: 2.1, $lte: 3 },
                'up4Star': { $gte: 3.1, $lte: 4 },
                'up5Star': { $gte: 4.1, $lte: 5 },
            };
            if (ratingRanges[rating]) {
                filter.rating = ratingRanges[rating];
            } else {
                return res.status(400).json({ message: 'Invalid rating value' });
            }
        }

        // Pagination
        const pageSize = parseInt(limit) || 0;
        const pageNum = parseInt(page) || 1;
        const skip = pageSize * (pageNum - 1);

        // Fetch unique categories
        const uniqueCategories = await Product.distinct("category");

        // Count total documents and fetch results
        const totalDocs = await Product.countDocuments(filter);
        const results = await Product.find(filter)
            .populate("brand")
            .skip(skip)
            .limit(pageSize)
            .exec();

        // Set total count in header and send response
        res.set("X-Total-Count", totalDocs);
        res.status(200).json({ results, categories: uniqueCategories });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error fetching products, please try again later' });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params
        const result = await Product.findById(id).populate("brand").populate("category")
        res.status(200).json(result)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error getting product details, please try again later' })
    }
}

exports.updateById = async (req, res) => {
    try {
        const { id } = req.params
        const updated = await Product.findByIdAndUpdate(id, req.body, { new: true })
        res.status(200).json(updated)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error updating product, please try again later' })
    }
}

exports.undeleteById = async (req, res) => {
    try {
        const { id } = req.params
        const unDeleted = await Product.findByIdAndUpdate(id, { isDeleted: false }, { new: true }).populate('brand')
        res.status(200).json(unDeleted)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error restoring product, please try again later' })
    }
}

exports.deleteById = async (req, res) => {
    try {
        const { id } = req.params
        const deleted = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).populate("brand")
        res.status(200).json(deleted)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error deleting product, please try again later' })
    }
}


