const express = require('express');
const router = express.Router();
const Product = require('../schemas/Product');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create product
router.post('/', async (req, res) => {
  try {
    const User = require('../schemas/User');
    const user = await User.findOne({ email: req.body.sellerEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    if (user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Only administrators can list products.' });
    }

    const product = new Product({
      ...req.body,
      sales: 0
    });
    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
