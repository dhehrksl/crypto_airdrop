const express = require('express');
const router = express.Router();
const { getAirdrops, getAirdropById } = require('../controllers/airdropController');

// @route   GET /api/airdrops
// @desc    Get airdrops and news
router.get('/', getAirdrops);

// @route   GET /api/airdrops/:id
// @desc    Get a single airdrop or news item by ID
router.get('/:id', getAirdropById);

module.exports = router;
