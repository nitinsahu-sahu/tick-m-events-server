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
  type: {
    type: String,
    required: true,
  },
  subcategories: [SubcategorySchema],
  urlSlug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
}, { timestamps: true });

CategorySchema.pre('save', async function(next) {
  try {
    // Only generate slug if eventName is modified or slug doesn't exist
    if (this.isModified('name') || !this.urlSlug) {
      const baseSlug = this.generateBaseSlug(this.name);
      this.urlSlug = await this.generateUniqueSlug(baseSlug);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Generate base slug from event name
CategorySchema.methods.generateBaseSlug = function(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// Generate unique slug with incremental suffix if needed
CategorySchema.methods.generateUniqueSlug = async function(baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    // Check if slug exists for non-deleted events (excluding current document if updating)
    const existingEvent = await this.constructor.findOne({
      urlSlug: slug,
      isDelete: { $ne: true },
      _id: { $ne: this._id } // Exclude current event when updating
    });

    if (!existingEvent) {
      isUnique = true;
    } else {
      // Add incremental suffix
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return slug;
};

module.exports = mongoose.model('Category', CategorySchema);
