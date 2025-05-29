const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  subcategories: [this]
});

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  cover: {
    public_id: { type: String, required: true },
    url: { type: String, required: true }
  },
  subcategories: [SubcategorySchema],
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
