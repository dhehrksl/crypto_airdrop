const express = require('express');
const router = express.Router();
const { getPriceData } = require('../controllers/marketController');

// @route   GET /api/market/price
// @desc    Get real-time price data for a cryptocurrency
// @access  Public (for now)
router.get('/price', getPriceData);

module.exports = router;
