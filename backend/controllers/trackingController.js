// 워치리스트 + 단계별 진행 추적 컨트롤러 (airdrop-tracking-toolkit).
// AirdropTracking 컬렉션 하나로 (사용자, 에어드랍)별 관심 여부·완료 단계를 다룬다.
// 기존 참여 기능(userController.markAsParticipated 등)과 독립적.

const mongoose = require('mongoose');
const Airdrop = require('../models/Airdrop');
const AirdropTracking = require('../models/AirdropTracking');
const logger = require('../src/lib/logger');

// --- 워치리스트 ---

// @desc  관심 목록에 추가 (멱등)
// @route POST /api/user/airdrops/:id/watchlist
const addToWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;
    if (!mongoose.isValidObjectId(airdropId)) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }
    const airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) return res.status(404).json({ msg: 'Airdrop not found' });

    const tracking = await AirdropTracking.findOneAndUpdate(
      { user: userId, airdrop: airdropId },
      { $set: { watchlisted: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, watchlisted: tracking.watchlisted });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'addToWatchlist failed');
    res.status(500).send('Server Error');
  }
};

// @desc  관심 목록에서 제거 (멱등) — 진행/리마인더 이력 보존 위해 문서는 남기고 플래그만 끈다
// @route DELETE /api/user/airdrops/:id/watchlist
const removeFromWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;
    if (mongoose.isValidObjectId(airdropId)) {
      await AirdropTracking.updateOne(
        { user: userId, airdrop: airdropId },
        { $set: { watchlisted: false } }
      );
    }
    res.json({ ok: true, watchlisted: false });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'removeFromWatchlist failed');
    res.status(500).send('Server Error');
  }
};

// @desc  내 관심 목록 조회 (에어드랍 정보 join)
// @route GET /api/user/airdrops/watchlist
const getWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const docs = await AirdropTracking.find({ user: userId, watchlisted: true })
      .sort({ updatedAt: -1 })
      .populate('airdrop');
    // airdrop이 삭제/강등돼 null인 항목은 제외
    const data = docs
      .filter((d) => d.airdrop)
      .map((d) => ({
        ...d.airdrop.toObject(),
        tracking: {
          watchlisted: true,
          completedTasks: [...d.completedTasks].sort((a, b) => a - b),
        },
      }));
    res.json({ data });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'getWatchlist failed');
    res.status(500).send('Server Error');
  }
};

// --- 단계별 진행 ---

// @desc  참여 단계 하나를 완료/해제
// @route PUT /api/user/airdrops/:id/tasks/:index   body: { completed: boolean }
const setTaskProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;
    const index = Number(req.params.index);
    const completed = req.body?.completed === true;

    if (!mongoose.isValidObjectId(airdropId)) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }
    const airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) return res.status(404).json({ msg: 'Airdrop not found' });

    const totalTasks = Array.isArray(airdrop.tasks) ? airdrop.tasks.length : 0;
    if (!Number.isInteger(index) || index < 0 || index >= totalTasks) {
      return res.status(400).json({ msg: '유효하지 않은 단계 인덱스입니다.' });
    }

    const update = completed
      ? { $addToSet: { completedTasks: index } }
      : { $pull: { completedTasks: index } };
    const tracking = await AirdropTracking.findOneAndUpdate(
      { user: userId, airdrop: airdropId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({
      ok: true,
      watchlisted: tracking.watchlisted,
      completedTasks: [...tracking.completedTasks].sort((a, b) => a - b),
      totalTasks,
    });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'setTaskProgress failed');
    res.status(500).send('Server Error');
  }
};

// @desc  특정 에어드랍에 대한 내 추적 상태 (관심 여부 + 완료 단계 + 전체 단계 수)
// @route GET /api/user/airdrops/:id/tracking
const getTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;
    if (!mongoose.isValidObjectId(airdropId)) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }
    const airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) return res.status(404).json({ msg: 'Airdrop not found' });

    const totalTasks = Array.isArray(airdrop.tasks) ? airdrop.tasks.length : 0;
    const tracking = await AirdropTracking.findOne({ user: userId, airdrop: airdropId });
    res.json({
      watchlisted: tracking?.watchlisted || false,
      completedTasks: [...(tracking?.completedTasks || [])].sort((a, b) => a - b),
      totalTasks,
    });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'getTracking failed');
    res.status(500).send('Server Error');
  }
};

module.exports = {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  setTaskProgress,
  getTracking,
};
