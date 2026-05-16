const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  markAsParticipated,
  unmarkAsParticipated,
  getParticipatedAirdrops,
  deleteAccount,
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

// 회원 탈퇴 라우트는 server.js에서 직접 등록 (Express 5 라우터의 정적 path 매칭 이슈 회피)

module.exports = router;
