const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cat: { type: String, required: true },
  price: { type: Number, required: true },
  desc: { type: String, required: true },
  icon: { type: String, default: '🤖' },
  sales: { type: Number, default: 0 },
  tags: [{ type: String }],
  sellerEmail: { type: String },
  sellerName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
