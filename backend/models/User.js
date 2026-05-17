const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // 대소문자 차이로 중복 우회 방지 — 신규 등록부터 적용
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
  isAdmin: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
