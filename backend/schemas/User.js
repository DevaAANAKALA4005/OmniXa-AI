const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'seller'] },
  subscriptionPlan: { type: String, enum: ['None', 'Basic', 'Pro', 'Enterprise'], default: 'None' },
  avatar: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
