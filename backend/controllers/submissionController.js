const crypto = require('crypto');
const Submission = require('../models/Submission');
const Airdrop = require('../models/Airdrop');
const logger = require('../src/lib/logger');

// 사용자가 새 제보를 만든다
// POST /api/submissions
const createSubmission = async (req, res) => {
  try {
    const { title, description, official_link, category, chain, end_date } = req.body;
    if (!title || !description || !official_link) {
      return res.status(400).json({ msg: '제목, 설명, 공식 링크는 필수입니다.' });
    }
    const doc = await Submission.create({
      submittedBy: req.user.id,
      title: String(title).trim(),
      description: String(description).trim(),
      official_link: String(official_link).trim(),
      category: category ? String(category).trim() : undefined,
      chain: chain ? String(chain).trim() : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
    });
    res.status(201).json({ ok: true, submission: doc });
  } catch (err) {
    (req?.log || logger).error({ err }, 'createSubmission failed');
    res.status(500).json({ msg: '제보 저장 중 오류' });
  }
};

// 본인 제보 목록
// GET /api/submissions/mine
const listMySubmissions = async (req, res) => {
  try {
    const list = await Submission.find({ submittedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ data: list });
  } catch (err) {
    (req?.log || logger).error({ err }, 'listMySubmissions failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// 어드민: 전체 제보 목록 (status 필터)
// GET /api/admin/submissions?status=pending
const adminListSubmissions = async (req, res) => {
  try {
    const status = req.query.status;
    const q = status ? { status } : {};
    const list = await Submission.find(q)
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'username email')
      .lean();
    res.json({ data: list });
  } catch (err) {
    (req?.log || logger).error({ err }, 'adminListSubmissions failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// 어드민: 승인 → Airdrop 컬렉션으로 게시
// POST /api/admin/submissions/:id/approve
const adminApproveSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ msg: '제보를 찾을 수 없습니다.' });
    if (sub.status === 'approved') {
      return res.status(400).json({ msg: '이미 승인된 제보입니다.' });
    }

    const uniqueHash =
      'submission:' + crypto.createHash('sha256').update(sub._id.toString()).digest('hex').slice(0, 24);

    const airdropData = {
      title: sub.title,
      description: sub.description,
      official_link: sub.official_link,
      trend_score: 75, // 어드민 승인 기본값
      is_confirmed: true,
      is_airdrop: true,
      is_scam: false,
      source: ['curated'],
      unique_hash: uniqueHash,
    };
    if (sub.category) airdropData.category = sub.category;
    if (sub.chain) airdropData.chain = [sub.chain];
    if (sub.end_date) airdropData.end_date = sub.end_date;

    const airdrop = await Airdrop.findOneAndUpdate(
      { unique_hash: { $eq: uniqueHash } },
      { $set: airdropData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    sub.status = 'approved';
    sub.reviewedBy = req.user.id;
    sub.reviewedAt = new Date();
    sub.reviewNote = req.body?.note || '';
    sub.publishedAirdrop = airdrop._id;
    await sub.save();

    res.json({ ok: true, airdrop, submission: sub });
  } catch (err) {
    (req?.log || logger).error({ err }, 'adminApproveSubmission failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// 어드민: 거절
// POST /api/admin/submissions/:id/reject
const adminRejectSubmission = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ msg: '제보를 찾을 수 없습니다.' });
    sub.status = 'rejected';
    sub.reviewedBy = req.user.id;
    sub.reviewedAt = new Date();
    sub.reviewNote = req.body?.note || '';
    await sub.save();
    res.json({ ok: true, submission: sub });
  } catch (err) {
    (req?.log || logger).error({ err }, 'adminRejectSubmission failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

module.exports = {
  createSubmission,
  listMySubmissions,
  adminListSubmissions,
  adminApproveSubmission,
  adminRejectSubmission,
};
