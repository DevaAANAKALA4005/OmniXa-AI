const express = require('express');
const router = express.Router();
const Order = require('../schemas/Order');
const Product = require('../schemas/Product');

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create order
router.post('/', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    
    // Update sales count in Product
    await Product.findByIdAndUpdate(order.productId, { $inc: { sales: 1 } });
    
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user purchases
router.get('/purchases', async (req, res) => {
  try {
    const { email } = req.query;
    const orders = await Order.find({ buyerEmail: email, status: 'Paid' }).populate('productId');
    
    const purchases = orders.map(o => {
      if (!o.productId) return null;
      return {
        ...o.productId._doc,
        id: o.productId._id,
        boughtOn: o.date
      };
    }).filter(p => p !== null);
    
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
