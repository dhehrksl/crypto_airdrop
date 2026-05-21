const Airdrop = require('../models/Airdrop');
const User = require('../models/User');
const AirdropTracking = require('../models/AirdropTracking');
const logger = require('../src/lib/logger');

// @desc    Mark an airdrop as participated by the user
// @route   POST /api/user/airdrops/:id/participate
const markAsParticipated = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;

    const airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }

    if (airdrop.participatedBy.includes(userId)) {
      return res.status(400).json({ msg: 'Already marked as participated' });
    }

    airdrop.participatedBy.push(userId);
    await airdrop.save();

    res.json(airdrop);
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'markAsParticipated failed');
    res.status(500).send('Server Error');
  }
};

// @desc    Unmark an airdrop as participated
// @route   DELETE /api/user/airdrops/:id/participate
const unmarkAsParticipated = async (req, res) => {
  try {
    const userId = req.user.id;
    const airdropId = req.params.id;

    const airdrop = await Airdrop.findById(airdropId);
    if (!airdrop) {
      return res.status(404).json({ msg: 'Airdrop not found' });
    }

    airdrop.participatedBy = airdrop.participatedBy.filter(
      (id) => id.toString() !== userId
    );

    await airdrop.save();

    res.json(airdrop);
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'unmarkAsParticipated failed');
    res.status(500).send('Server Error');
  }
};

// @desc    Get all airdrops participated by the user
// @route   GET /api/user/airdrops/participated
const getParticipatedAirdrops = async (req, res) => {
  try {
    const userId = req.user.id;
    const participated = await Airdrop.find({ participatedBy: userId })
      .sort({ created_at: -1 })
      .lean();

    // 단계별 진행 상태를 함께 붙인다 (UserScreen 진행률 표시용)
    const trackingDocs = await AirdropTracking.find({
      user: userId,
      airdrop: { $in: participated.map((a) => a._id) },
    }).lean();
    const byAirdrop = new Map();
    for (const d of trackingDocs) byAirdrop.set(String(d.airdrop), d);

    const data = participated.map((a) => {
      const t = byAirdrop.get(String(a._id));
      return {
        ...a,
        tracking: {
          watchlisted: t?.watchlisted || false,
          completedTasks: [...(t?.completedTasks || [])].sort((x, y) => x - y),
        },
      };
    });
    res.json({ data });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'getParticipatedAirdrops failed');
    res.status(500).send('Server Error');
  }
};

// @desc    Delete current user account and scrub their data
// @route   DELETE /api/user/me
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // 1) participatedBy 배열에서 사용자 ID 제거
    await Airdrop.updateMany(
      { participatedBy: userId },
      { $pull: { participatedBy: userId } }
    );

    // 2) 사용자 삭제 (push_token, googleId, password 모두 함께 제거)
    await User.deleteOne({ _id: userId });

    res.json({ ok: true, msg: '계정과 모든 개인정보가 삭제되었습니다.' });
  } catch (error) {
    (req?.log || logger).error({ err: error }, 'deleteAccount failed');
    res.status(500).send('Server Error');
  }
};

module.exports = {
  markAsParticipated,
  unmarkAsParticipated,
  getParticipatedAirdrops,
  deleteAccount,
};
