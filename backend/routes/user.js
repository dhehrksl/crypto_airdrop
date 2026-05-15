const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  markAsParticipated,
  unmarkAsParticipated,
  getParticipatedAirdrops,
} = require('../controllers/userController');

// All routes in this file are protected and require a valid token

// @route   GET /api/user/airdrops/participated
// @desc    Get all airdrops a user has participated in
// @access  Private
router.get('/airdrops/participated', authMiddleware, getParticipatedAirdrops);

// @route   POST /api/user/airdrops/:id/participate
// @desc    Mark an airdrop as participated
// @access  Private
router.post('/airdrops/:id/participate', authMiddleware, markAsParticipated);

// @route   DELETE /api/user/airdrops/:id/participate
// @desc    Unmark an airdrop as participated
// @access  Private
router.delete('/airdrops/:id/participate', authMiddleware, unmarkAsParticipated);

module.exports = router;
