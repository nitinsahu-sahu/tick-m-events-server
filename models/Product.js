const mongoose = require('mongoose');
const { Schema } = mongoose;

// Review Sub-Schema
const reviewSchema = new Schema({
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  date: { type: Date, default: Date.now },
  reviewerName: { type: String, required: true },
  reviewerEmail: { type: String, required: true },
});

// Dimensions Sub-Schema
const dimensionsSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  depth: { type: Number, required: true },
});

// Meta Sub-Schema
const metaSchema = new Schema({
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  barcode: { type: String, required: true },
  qrCode: { type: String, required: true },
});

// Main Product Schema
const productSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String },
  price: { type: Number, required: true },
  priceSale: { type: Number, required: true },
  rating: { type: Number },
  stock: { type: Number, required: true },
  tags: { type: [String], required: true },
  brand: { type: String, required: true },
  sku: { type: String, required: true },
  weight: { type: Number },
  dimensions: dimensionsSchema,
  warrantyInformation: { type: String },
  shippingInformation: { type: String },
  availabilityStatus: { type: String },
  reviews: [reviewSchema],
  returnPolicy: { type: String, required: true },
  minimumOrderQuantity: { type: Number, required: true },
  meta: metaSchema,
  images: { type: [String], required: true },
  coverUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ['new', 'sale', 'inActive'],
    default: 'new'
  },
});

// Create and export the Product model
const Product = mongoose.model('Product', productSchema);
module.exports = Product;