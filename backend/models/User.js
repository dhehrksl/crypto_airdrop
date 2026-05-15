const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple nulls, but unique if not null
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    // Not required for social login
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple nulls, but unique if not null
  },
  avatarUrl: {
    type: String,
  },
  push_token: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
