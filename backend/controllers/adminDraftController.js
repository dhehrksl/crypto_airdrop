// 관리자용 AirdropDraft 컨트롤러.
// 목록 조회 / 승인(→Airdrop으로 승격) / 거절 / 수정 / 임의 URL → Draft 추출.

const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const AirdropDraft = require('../models/AirdropDraft');
const Airdrop = require('../models/Airdrop');
const { isBlockedSource } = require('../src/config/blockedSources');
const { fetchRedditAirdrops } = require('../src/services/redditSource');
const { fetchTelegramAirdrops } = require('../src/services/telegramSource');
const { extractAndSaveBatch, extractSingle } = require('../src/services/draftExtractor');
const logger = require('../src/lib/logger');

const URL_FETCH_TIMEOUT_MS = 15000;
const URL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// GET /api/admin/drafts?status=pending
const listDrafts = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const drafts = await AirdropDraft.find({ status })
      .sort({ collected_at: -1 })
      .limit(limit)
      .lean();
    res.json({ data: drafts, count: drafts.length });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'listDrafts failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// PATCH /api/admin/drafts/:id — 승인 전 필드 수정
const updateDraft = async (req, res) => {
  try {
    const d = await AirdropDraft.findById(req.params.id);
    if (!d) return res.status(404).json({ msg: 'Draft not found' });
    if (d.status !== 'pending') {
      return res.status(400).json({ msg: '이미 처리된 항목입니다.' });
    }
    const allowed = ['title', 'description', 'official_link', 'tokenTicker', 'tasks', 'end_date', 'category', 'chain', 'trend_score'];
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      const v = req.body[key];
      if (key === 'tasks') {
        d.tasks = Array.isArray(v) ? v.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : d.tasks;
      } else if (key === 'chain') {
        d.chain = Array.isArray(v) ? v.map((c) => String(c).trim()).filter(Boolean) : (v ? [String(v).trim()] : undefined);
      } else if (key === 'end_date') {
        const date = v ? new Date(v) : null;
        d.end_date = date && !isNaN(date.getTime()) ? date : undefined;
      } else if (key === 'trend_score') {
        const n = Number(v);
        if (Number.isFinite(n)) d.trend_score = Math.min(100, Math.max(0, n));
      } else {
        d[key] = v === '' || v === null ? undefined : (typeof v === 'string' ? v.trim() : v);
      }
    }
    await d.save();
    res.json({ ok: true, draft: d });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'updateDraft failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

function buildPublishHash(d) {
  return 'curated:' + crypto.createHash('sha256').update(`${d.title}|${d.official_link}|${Date.now()}`).digest('hex').slice(0, 24);
}

// POST /api/admin/drafts/:id/approve
const approveDraft = async (req, res) => {
  try {
    const d = await AirdropDraft.findById(req.params.id);
    if (!d) return res.status(404).json({ msg: 'Draft not found' });
    if (d.status !== 'pending') return res.status(400).json({ msg: '이미 처리된 항목입니다.' });

    const blocked = isBlockedSource({ link: d.official_link });
    if (blocked.blocked) {
      return res.status(400).json({
        msg: `차단된 출처입니다: ${blocked.matched} (${blocked.reason})`,
      });
    }

    const airdropDoc = {
      title: d.title,
      description: d.description,
      official_link: d.official_link,
      tokenTicker: d.tokenTicker,
      tasks: Array.isArray(d.tasks) && d.tasks.length > 0 ? d.tasks : undefined,
      end_date: d.end_date,
      category: d.category,
      chain: Array.isArray(d.chain) && d.chain.length > 0 ? d.chain : undefined,
      trend_score: d.trend_score || 70,
      is_confirmed: true, // 관리자 승인 = 공식 확정 표시
      is_airdrop: true,
      is_scam: false,
      source: ['curated', d.source_name].filter(Boolean),
      unique_hash: buildPublishHash(d),
    };

    const created = await Airdrop.create(airdropDoc);
    d.status = 'approved';
    d.reviewedBy = req.user?.id;
    d.reviewedAt = new Date();
    d.reviewNote = req.body?.note || '';
    d.publishedAirdrop = created._id;
    await d.save();

    res.json({ ok: true, airdrop: created });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'approveDraft failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// POST /api/admin/drafts/:id/reject
const rejectDraft = async (req, res) => {
  try {
    const d = await AirdropDraft.findById(req.params.id);
    if (!d) return res.status(404).json({ msg: 'Draft not found' });
    if (d.status !== 'pending') return res.status(400).json({ msg: '이미 처리된 항목입니다.' });
    d.status = 'rejected';
    d.reviewedBy = req.user?.id;
    d.reviewedAt = new Date();
    d.reviewNote = req.body?.note || '';
    await d.save();
    res.json({ ok: true });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'rejectDraft failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// DELETE /api/admin/drafts/:id — 거절된 것도 영구 삭제 가능
const deleteDraft = async (req, res) => {
  try {
    const r = await AirdropDraft.deleteOne({ _id: req.params.id });
    if (r.deletedCount === 0) return res.status(404).json({ msg: 'Draft not found' });
    res.json({ ok: true });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'deleteDraft failed');
    res.status(500).json({ msg: 'Server Error' });
  }
};

// 페이지 HTML에서 본문 추출 — 단순 휴리스틱 (article/main 우선, 없으면 body)
function extractTextFromHtml(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, noscript').remove();
  let text = '';
  const sel = ['article', 'main', '.post', '.content', '[role="main"]'];
  for (const s of sel) {
    const el = $(s).first();
    if (el.length) {
      text = el.text();
      if (text.trim().length > 200) break;
    }
  }
  if (!text || text.trim().length < 200) {
    text = $('body').text();
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
}

// POST /api/admin/drafts/from-url { url, source_label? }
const draftFromUrl = async (req, res) => {
  try {
    const { url, source_label } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ msg: 'url 필수' });
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('protocol');
    } catch {
      return res.status(400).json({ msg: '유효한 http(s) URL이 아닙니다.' });
    }

    const blocked = isBlockedSource({ link: url });
    if (blocked.blocked) {
      return res.status(400).json({ msg: `차단된 출처: ${blocked.matched}` });
    }

    let html;
    try {
      const r = await axios.get(url, {
        timeout: URL_FETCH_TIMEOUT_MS,
        headers: { 'User-Agent': URL_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        maxRedirects: 5,
      });
      html = r.data;
    } catch (e) {
      return res.status(502).json({ msg: `페이지를 가져오지 못했습니다: ${e.message}` });
    }
    if (typeof html !== 'string') return res.status(502).json({ msg: '페이지 응답이 HTML이 아닙니다.' });

    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('title').text() ||
                  parsedUrl.hostname;
    const content = extractTextFromHtml(html);
    if (content.length < 100) {
      return res.status(422).json({ msg: '본문이 너무 짧아 추출할 수 없습니다.' });
    }

    const hashSeed = `url:${url}`;
    const item = {
      id: 'url:' + crypto.createHash('sha256').update(hashSeed).digest('hex').slice(0, 24),
      title: String(title).trim().slice(0, 200),
      content,
      link: url,
      sourceName: source_label ? `URL:${source_label}` : `URL:${parsedUrl.hostname}`,
    };

    const r = await extractSingle(item);
    if (!r.saved) {
      return res.status(422).json({ msg: '추출 실패', reason: r.reason, ai: r.ai });
    }
    const saved = await AirdropDraft.findOne({ unique_hash: item.id });
    res.json({ ok: true, draft: saved });
  } catch (e) {
    (req?.log || logger).error({ err: e }, 'draftFromUrl failed');
    res.status(500).json({ msg: 'Server Error', detail: e.message });
  }
};

// POST /api/admin/drafts/collect — Reddit + Telegram 즉시 수집 트리거
let _collectRunning = false;
let _lastCollectAt = 0;
const COLLECT_COOLDOWN_MS = 15 * 60 * 1000;

async function runCollection(reason = 'manual') {
  if (_collectRunning) return { started: false, reason: 'already-running' };
  const elapsed = Date.now() - _lastCollectAt;
  if (elapsed < COLLECT_COOLDOWN_MS) {
    return {
      started: false,
      reason: 'cooldown',
      retryAfterSec: Math.ceil((COLLECT_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  _collectRunning = true;
  _lastCollectAt = Date.now();
  logger.info({ reason }, '[Draft Collect] triggered');
  try {
    // Reddit 자동 수집은 Reddit Data API ToS상 상업적 사용 회색 영역 — 기본 비활성.
    // 켜려면 env DRAFT_REDDIT_ENABLED=true.
    const redditEnabled = process.env.DRAFT_REDDIT_ENABLED === 'true';
    const [reddit, telegram] = await Promise.all([
      redditEnabled
        ? fetchRedditAirdrops().catch((e) => { logger.warn({ err: e }, '[Draft Collect] reddit fetch failed'); return []; })
        : Promise.resolve([]),
      fetchTelegramAirdrops().catch((e) => { logger.warn({ err: e }, '[Draft Collect] telegram fetch failed'); return []; }),
    ]);
    if (!redditEnabled) logger.info('[Draft Collect] Reddit disabled (set DRAFT_REDDIT_ENABLED=true to enable)');
    const items = [...reddit, ...telegram];
    // 이미 수집된 unique_hash는 미리 제외해 AI 호출 비용 절감
    const seen = await AirdropDraft.find(
      { unique_hash: { $in: items.map((i) => i.id) } },
      { unique_hash: 1 }
    ).lean();
    const seenSet = new Set(seen.map((s) => s.unique_hash));
    const fresh = items.filter((i) => !seenSet.has(i.id));
    logger.info({ collected: items.length, fresh: fresh.length }, '[Draft Collect] → AI extraction');
    let stats = { saved: 0, skipped: 0, errors: 0, aiCalls: 0, reasons: {} };
    if (fresh.length > 0) {
      stats = await extractAndSaveBatch(fresh);
    }
    return { started: true, fresh: fresh.length, collected: items.length, stats };
  } finally {
    _collectRunning = false;
  }
}

const triggerCollect = async (req, res) => {
  const r = await runCollection('http');
  if (!r.started) {
    return res.status(r.reason === 'cooldown' ? 429 : 409).json(r);
  }
  res.json(r);
};

module.exports = {
  listDrafts,
  updateDraft,
  approveDraft,
  rejectDraft,
  deleteDraft,
  draftFromUrl,
  triggerCollect,
  runCollection,
};
