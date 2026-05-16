const crypto = require('crypto');
const Airdrop = require('../models/Airdrop');

function buildUniqueHash(seed) {
  return 'curated:' + crypto.createHash('sha256').update(seed + Date.now().toString()).digest('hex').slice(0, 24);
}

// POST /api/admin/airdrops — 직접 등록
const adminCreateAirdrop = async (req, res) => {
  try {
    const {
      title,
      description,
      official_link,
      category,
      chain,
      end_date,
      trust_score,
      is_confirmed,
      tokenTicker,
    } = req.body;
    if (!title || !description || !official_link) {
      return res.status(400).json({ msg: '제목, 설명, 공식 링크는 필수입니다.' });
    }
    const uniqueHash = buildUniqueHash(title + official_link);
    const doc = {
      title: String(title).trim(),
      description: String(description).trim(),
      official_link: String(official_link).trim(),
      trust_score: Number.isFinite(Number(trust_score)) ? Math.min(100, Math.max(0, Number(trust_score))) : 75,
      is_confirmed: !!is_confirmed,
      is_airdrop: true,
      is_scam: false,
      source: ['curated'],
      unique_hash: uniqueHash,
    };
    if (category) doc.category = String(category).trim();
    if (chain) doc.chain = Array.isArray(chain) ? chain : [String(chain).trim()];
    if (end_date) {
      const d = new Date(end_date);
      if (!isNaN(d.getTime())) doc.end_date = d;
    }
    if (tokenTicker) doc.tokenTicker = String(tokenTicker).trim();

    const created = await Airdrop.create(doc);
    res.status(201).json({ ok: true, airdrop: created });
  } catch (err) {
    console.error('adminCreateAirdrop error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// PUT /api/admin/airdrops/:id — 수정
const adminUpdateAirdrop = async (req, res) => {
  try {
    const a = await Airdrop.findById(req.params.id);
    if (!a) return res.status(404).json({ msg: 'Airdrop not found' });

    const allowed = ['title', 'description', 'official_link', 'category', 'chain', 'end_date', 'trust_score', 'is_confirmed', 'tokenTicker'];
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      const v = req.body[key];
      if (v === null || v === undefined || v === '') {
        a[key] = undefined;
        continue;
      }
      if (key === 'end_date') {
        const d = new Date(v);
        if (!isNaN(d.getTime())) a.end_date = d;
      } else if (key === 'chain') {
        a.chain = Array.isArray(v) ? v : [String(v).trim()];
      } else if (key === 'trust_score') {
        const n = Number(v);
        if (Number.isFinite(n)) a.trust_score = Math.min(100, Math.max(0, n));
      } else if (key === 'is_confirmed') {
        a.is_confirmed = !!v;
      } else {
        a[key] = typeof v === 'string' ? v.trim() : v;
      }
    }
    await a.save();
    res.json({ ok: true, airdrop: a });
  } catch (err) {
    console.error('adminUpdateAirdrop error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// DELETE /api/admin/airdrops/:id
const adminDeleteAirdrop = async (req, res) => {
  try {
    const result = await Airdrop.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ msg: 'Airdrop not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('adminDeleteAirdrop error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

module.exports = {
  adminCreateAirdrop,
  adminUpdateAirdrop,
  adminDeleteAirdrop,
};
