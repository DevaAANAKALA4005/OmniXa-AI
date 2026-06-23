const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../schemas/User');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { first, last, email, password } = req.body;
    
    if (email === 'admin@omnixaai.in') {
      return res.status(403).json({ success: false, message: 'Administrator registration is disabled. Please contact support.' });
    }

    const full_name = (first + ' ' + last).trim();

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      full_name,
      email,
      password: hashedPassword,
      role: 'buyer'
    });

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, token, user: { id: user._id, name: user.full_name, email: user.email, role: user.role, subscriptionPlan: user.subscriptionPlan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    // For demo purposes, if password is not provided (quick login), allow it
    // In production, always require password
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.role) {
      user.role = (user.email === 'admin@omnixaai.in') ? 'seller' : 'buyer';
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, token, user: { id: user._id, name: user.full_name, email: user.email, role: user.role, subscriptionPlan: user.subscriptionPlan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      // Existing user logic: if user not found, return an error.
      return res.status(400).json({ success: false, message: 'User not found. Please sign up first.' });
    }

    if (!user.role) {
      user.role = (user.email === 'admin@omnixaai.in') ? 'seller' : 'buyer';
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ success: true, token, user: { id: user._id, name: user.full_name, email: user.email, avatar: picture, role: user.role, subscriptionPlan: user.subscriptionPlan } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Google authentication failed: ' + err.message });
  }
});

// Sync role
router.put('/role', async (req, res) => {
  try {
    const { userId, email, role } = req.body;
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email });
    }
    
    if (user) {
      if (user.role && user.role !== role) {
        return res.status(400).json({ success: false, message: 'Role cannot be changed once assigned' });
      }
      user.role = role;
      await user.save();
      return res.json({ success: true, role: user.role });
    }
    res.status(404).json({ success: false, message: 'User not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Sync subscription plan
router.put('/subscription', async (req, res) => {
  try {
    const { email, plan } = req.body;
    let user = await User.findOne({ email });
    
    if (user) {
      user.subscriptionPlan = plan;
      await user.save();
      return res.json({ success: true, subscriptionPlan: user.subscriptionPlan });
    }
    res.status(404).json({ success: false, message: 'User not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update profile
router.put('/profile', async (req, res) => {
  try {
    const { email, full_name, avatar } = req.body;
    let user = await User.findOne({ email });
    
    if (user) {
      if (full_name) user.full_name = full_name;
      if (avatar) user.avatar = avatar;
      await user.save();
      
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      return res.json({ success: true, token, user: { id: user._id, name: user.full_name, email: user.email, avatar: user.avatar, role: user.role, subscriptionPlan: user.subscriptionPlan } });
    }
    res.status(404).json({ success: false, message: 'User not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
