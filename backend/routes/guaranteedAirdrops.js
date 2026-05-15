const express = require('express');
const router = express.Router();
const {
  getAllGuaranteedAirdrops,
  getGuaranteedAirdropById,
} = require('../controllers/guaranteedAirdropController');

// @route   GET /api/guaranteed-airdrops
// @desc    Get all guaranteed airdrops
router.get('/', getAllGuaranteedAirdrops);

// @route   GET /api/guaranteed-airdrops/:id
// @desc    Get a single guaranteed airdrop by ID
router.get('/:id', getGuaranteedAirdropById);

module.exports = router;
