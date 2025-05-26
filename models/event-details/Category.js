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
  subcategories: [SubcategorySchema],
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
