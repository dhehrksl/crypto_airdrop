const express = require('express');
const router = express.Router();
const { registerUser, loginUser, googleSignIn } = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', loginUser);

// @route   POST /api/auth/google/token-signin
// @desc    Authenticate user with Google ID token
router.post('/google/token-signin', googleSignIn);

module.exports = router;
