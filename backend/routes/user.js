const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  markAsParticipated,
  unmarkAsParticipated,
  getParticipatedAirdrops,
  deleteAccount,
} = require('../controllers/userController');
const {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  setTaskProgress,
  getTracking,
} = require('../controllers/trackingController');

// All routes in this file are protected and require a valid token

// @route   GET /api/user/airdrops/participated
// @desc    Get all airdrops a user has participated in
// @access  Private
router.get('/airdrops/participated', authMiddleware, getParticipatedAirdrops);

// @route   GET /api/user/airdrops/watchlist
// @desc    Get the user's watchlisted airdrops
// @access  Private
// (정적 경로 — :id 파라미터 라우트보다 먼저 등록)
router.get('/airdrops/watchlist', authMiddleware, getWatchlist);

// @route   POST /api/user/airdrops/:id/participate
// @desc    Mark an airdrop as participated
// @access  Private
router.post('/airdrops/:id/participate', authMiddleware, markAsParticipated);

// @route   DELETE /api/user/airdrops/:id/participate
// @desc    Unmark an airdrop as participated
// @access  Private
router.delete('/airdrops/:id/participate', authMiddleware, unmarkAsParticipated);

// @route   POST/DELETE /api/user/airdrops/:id/watchlist
// @desc    Add / remove an airdrop from the user's watchlist (idempotent)
// @access  Private
router.post('/airdrops/:id/watchlist', authMiddleware, addToWatchlist);
router.delete('/airdrops/:id/watchlist', authMiddleware, removeFromWatchlist);

// @route   PUT /api/user/airdrops/:id/tasks/:index
// @desc    Check / uncheck a participation step  body: { completed: boolean }
// @access  Private
router.put('/airdrops/:id/tasks/:index', authMiddleware, setTaskProgress);

// @route   GET /api/user/airdrops/:id/tracking
// @desc    Get the user's tracking state for an airdrop (watchlist + step progress)
// @access  Private
router.get('/airdrops/:id/tracking', authMiddleware, getTracking);

// 회원 탈퇴 라우트는 server.js에서 직접 등록 (Express 5 라우터의 정적 path 매칭 이슈 회피)

module.exports = router;
