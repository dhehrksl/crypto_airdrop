const axios = require('axios');
const RSSParser = require('rss-parser');

const Airdrop = require('../../models/Airdrop');
const User = require('../../models/User');
const logger = require('../lib/logger');
// expo-server-sdk v6는 ESM-only — sendPushNotifications 내부에서 dynamic import.
const { isBlockedSource } = require('../config/blockedSources');
const { fetchSnapshotProposals } = require('./snapshotSource');
// airdrops.io 스크래퍼는 ToS의 상업적 사용 금지 조항으로 제거됨.
// 뉴스 기능도 제거됨 — RSS는 "에어드랍 발견" 용도로만 쓰고, 에어드랍이 아닌
// 항목은 저장하지 않는다. 저장되는 Airdrop은 AI가 한국어로 재작성한 사실
// 메타데이터(캠페인명·마감일·공식 링크)이며 원문 기사를 복제하지 않는다.

const parser = new RSSParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const RSS_SOURCES = [
  // === 일반 암호화폐 뉴스 (광범위 커버) ===
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss/tag/airdrop' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Medium-Airdrop', url: 'https://medium.com/feed/tag/airdrop' },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { name: 'NewsBTC', url: 'https://www.newsbtc.com/tag/airdrop/feed/' },
  { name: 'TokenPost', url: 'https://tokenpost.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed/' },
  { name: 'The Block', url: 'https://theblock.co/rss.xml' },
  { name: 'Bitcoin.com News', url: 'https://news.bitcoin.com/feed' },
  { name: 'U.Today', url: 'https://u.today/rss' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed/' },
  { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed' },

  // === Medium 태그 피드 (에어드랍 활성 분야 좁게) ===
  { name: 'Medium-Restaking', url: 'https://medium.com/feed/tag/restaking' },
  { name: 'Medium-EigenLayer', url: 'https://medium.com/feed/tag/eigenlayer' },
  { name: 'Medium-ZKRollup', url: 'https://medium.com/feed/tag/zk-rollup' },
  { name: 'Medium-Layer2', url: 'https://medium.com/feed/tag/layer-2' },
  { name: 'Medium-DePIN', url: 'https://medium.com/feed/tag/depin' },
  { name: 'Medium-Testnet', url: 'https://medium.com/feed/tag/testnet' },

  // === 거버넌스 포럼 (Discourse 기본 RSS) ===
  { name: 'Forum-Arbitrum', url: 'https://forum.arbitrum.foundation/latest.rss' },
  { name: 'Forum-Optimism', url: 'https://gov.optimism.io/latest.rss' },
  { name: 'Forum-Celestia', url: 'https://forum.celestia.org/latest.rss' },

  // === 프로젝트 공식 블로그 ===
  { name: 'Blog-Celestia', url: 'https://blog.celestia.org/rss/' },
  { name: 'Blog-Ethereum', url: 'https://blog.ethereum.org/feed.xml' },
  { name: 'Blog-Sui', url: 'https://blog.sui.io/rss/' },
  { name: 'Blog-EigenLayer', url: 'https://blog.eigenlayer.xyz/rss/' },
  { name: 'Blog-Thirdweb', url: 'https://blog.thirdweb.com/rss/' },

  // === Medium 공식 publication ===
  { name: 'Medium-StarkWare', url: 'https://medium.com/feed/@starkware' },
  { name: 'Medium-AaveProtocol', url: 'https://medium.com/feed/@aave' },
  { name: 'Medium-AptosLabs', url: 'https://aptoslabs.medium.com/feed' },
];

const POSITIVE_PATTERNS = [
  /airdrop/i, /claim/i, /snapshot/i, /eligib/i, /testnet/i, /mainnet/i,
  /incentivized/i, /waitlist/i, /points/i, /reward/i, /quest/i, /whitelist/i
];

// NEGATIVE는 광고/잡음만 거른다.
const NEGATIVE_PATTERNS = [
  /price prediction/i,
  /horoscope/i,
  /astrology/i,
  /sponsored\s+post/i,
  /press\s+release/i,
];

async function fetchRealData() {
  let allItems = [];
  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, 15).map(item => ({
        id: String(item.guid || item.link),
        title: item.title,
        content: item.contentSnippet || item.content || "",
        link: item.link,
        sourceName: source.name
      }));
      allItems = [...allItems, ...items];
    } catch (error) {
      const reason = error.status ? `Status ${error.status}` : 'Fetch/Parse Error';
      logger.warn({ source: source.name, reason }, '[Skip Source]');
    }
  }

  // Snapshot DAO 거버넌스 — 활성 proposal 중 에어드랍/분배 키워드 매치만
  try {
    const snapshotItems = await fetchSnapshotProposals();
    if (snapshotItems.length > 0) {
      logger.info({ count: snapshotItems.length }, '[Snapshot] fetched airdrop-related active proposals');
      allItems = [...allItems, ...snapshotItems];
    }
  } catch (e) {
    logger.warn({ err: e }, '[Snapshot] fetch error');
  }

  return Array.from(new Map(allItems.map(item => [item.id, item])).values());
}

function evaluateNews(item) {
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  if (NEGATIVE_PATTERNS.some(p => p.test(title))) return { skip: true, reason: 'noise in title' };
  let score = 0;
  POSITIVE_PATTERNS.forEach(p => {
    if (p.test(title)) score += 10;
    if (p.test(content)) score += 2;
  });
  if (/airdrop|claim|snapshot|testnet/i.test(title)) score += 20;
  return { skip: false, score, reason: 'ok' };
}

async function sendPushNotifications(airdrop) {
  const users = await User.find({ push_token: { $exists: true, $ne: null } });
  if (users.length === 0) return;
  const { Expo } = await import('expo-server-sdk');
  const expo = new Expo();
  const messages = users.filter(u => Expo.isExpoPushToken(u.push_token)).map(u => ({
    to: u.push_token,
    sound: 'default',
    title: '새 에어드랍 정보',
    body: `${airdrop.title} 정보가 추가되었습니다. (정보 제공 목적이며 투자 권유가 아닙니다)`,
    data: { airdropId: airdrop._id },
  }));
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { logger.error({ err: e }, 'push send failed'); }
  }
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// 휴리스틱 점수 임계값
// score < AI_THRESHOLD : AI 호출 안 함 → 저장하지 않음 (에어드랍 여부 신뢰성 있게 판별 불가)
// score >= AI_THRESHOLD: AI 호출하여 정밀 분석 (배치 처리)
const SKIP_THRESHOLD = 0;
const AI_THRESHOLD = 5;
const BATCH_SIZE = 20;

// AI가 "활성 에어드랍"으로 분류했지만 사실은 이미 끝난 경우를 잡아내는 사후 검증.
const POST_AIRDROP_GUARD_GRACE_MS = 60 * 60 * 1000; // 1시간
const ENDED_KEYWORDS_REGEX =
  /\b(airdrop\s+(has\s+)?ended|distribution\s+(is\s+)?complete|claim\s+period\s+closed|claim\s+window\s+closed|tokens\s+have\s+been\s+distributed|snapshot\s+(was|has been)\s+taken)\b/i;

// 회고성 가격/시세 분석 기사 — 제목에 "가격/가치/시총 + 등락 서술"이 있으면
// 참여 가능한 캠페인이 아니라 사후 뉴스다. (예: "ETHFI Value Drops By 35%")
const RETROSPECTIVE_TITLE_REGEX =
  /\b(price|value|valuation|market\s*cap)\b[^.!?]{0,40}\b(drop|fall|plunge|tumbl|stumbl|crash|sink|slump|slip|dip|surg|soar|rall|jump|spike|rise|gain|plummet|nosediv|down|up)/i;
// 사후 시점을 명시하는 제목 패턴 (예: "after the airdrop", "Market Turbulence").
const POST_EVENT_TITLE_REGEX =
  /\bafter\s+(the\s+|its\s+)?airdrop\b|\bpost[-\s]?airdrop\b|\bmarket\s+turbulence\b/i;

function shouldDemoteAirdrop(aiResult, item) {
  if (!aiResult || aiResult.is_airdrop !== true) return { demote: false };

  if (aiResult.end_date) {
    const d = new Date(aiResult.end_date);
    if (!isNaN(d.getTime())) {
      if (d.getTime() < Date.now() - POST_AIRDROP_GUARD_GRACE_MS) {
        return { demote: true, reason: 'past_end_date', parsedEndDate: d };
      }
      return { demote: false, parsedEndDate: d };
    }
  }

  const haystack = `${item.title || ''}\n${item.content || ''}`;
  if (ENDED_KEYWORDS_REGEX.test(haystack)) {
    return { demote: true, reason: 'ended_keyword_in_body' };
  }

  // 제목이 가격/시세 회고 기사면 강등 — 본문이 아닌 제목만 본다(본문은 시세 언급이 잦음).
  const title = item.title || '';
  if (RETROSPECTIVE_TITLE_REGEX.test(title) || POST_EVENT_TITLE_REGEX.test(title)) {
    return { demote: true, reason: 'retrospective_price_news' };
  }

  return { demote: false };
}

async function saveAiResult(item, aiResult) {
  if (!aiResult || aiResult.is_scam === true) return;

  // 사후 검증 — 이미 끝난 에어드랍은 활성 에어드랍으로 저장하지 않는다.
  const check = shouldDemoteAirdrop(aiResult, item);
  if (check.demote) {
    logger.warn(
      { title: aiResult.title, reason: check.reason },
      '[AI post-check] dropped ended airdrop'
    );
    aiResult = { ...aiResult, is_airdrop: false };
  }

  if (!aiResult.is_airdrop) {
    // 에어드랍이 아닌 항목은 저장하지 않는다 (뉴스 기능 제거됨).
    // 과거 잘못 분류돼 Airdrop에 들어간 항목이 있으면 제거한다.
    await Airdrop.deleteOne({ unique_hash: { $eq: item.id }, source: { $ne: 'airdrops.io' } });
    return;
  }

  const updateData = {
    title: aiResult.title,
    description: aiResult.description,
    official_link: aiResult.official_link || item.link,
    trend_score: aiResult.trend_score || 0,
    is_confirmed: aiResult.is_confirmed || false,
    is_airdrop: true,
    is_scam: aiResult.is_scam,
    source: [item.sourceName],
    unique_hash: item.id,
  };
  if (aiResult.end_date) {
    const d = new Date(aiResult.end_date);
    if (!isNaN(d.getTime())) updateData.end_date = d;
  }
  const newA = await Airdrop.findOneAndUpdate(
    { unique_hash: { $eq: item.id } },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (updateData.trend_score >= 90) await sendPushNotifications(newA);
  logger.info({ title: aiResult.title, score: aiResult.trend_score }, 'saved Airdrop');
}

function buildBatchPrompt(batch) {
  const inputs = batch.map((item, idx) => ({
    idx,
    title: item.title,
    content: (item.content || '').slice(0, 600),
    link: item.link,
  }));
  const todayISO = new Date().toISOString().slice(0, 10);
  return `
You are a cryptocurrency data aggregator and social trend analyst. Today's date is ${todayISO}.
Analyze the ${batch.length} news items provided.
Your goal is to extract metadata and determine if an item relates to an active airdrop campaign.

Respond ONLY with a JSON object with this EXACT structure:
{
  "results": [
    {
      "idx": <integer matching input idx>,
      "is_airdrop": <boolean>,
      "is_scam": <boolean>,
      "title": "<Short, neutral Korean title>",
      "description": "<VERY SHORT Korean context, exactly ONE sentence. e.g. '특정 프로젝트의 새로운 참여 캠페인이 소셜 미디어에서 언급되었습니다.'>",
      "trend_score": <integer 0-100, representing social mention frequency and hype>,
      "official_link": "<best official URL, fall back to input link if unknown>",
      "end_date": "<ISO 8601 datetime or null>"
    }
  ]
}

=== LEGAL SAFETY RULES (CRITICAL) ===
1. DO NOT translate or re-publish the full article content.
2. The "description" MUST be a neutral "context" statement in ONE sentence.
3. DO NOT give financial advice. Do not use words like "Trustworthy", "Invest", "Good opportunity".
4. "trend_score" represents how much people are talking about this (Social Buzz), NOT our trust in the project.

=== STRICT RULES FOR is_airdrop ===
Set is_airdrop=true ONLY when ALL of these hold:
- The article describes a SPECIFIC named campaign that is currently active or clearly upcoming.
- A regular user can take CONCRETE participation steps right now (join testnet, complete quests, register, claim, hold/stake for eligibility, etc.).
- The campaign is NOT already finished.

Set is_airdrop=false for:
- News or analysis ABOUT an airdrop that already happened (price reaction, valuation, market impact, token performance, "after the airdrop").
- Speculation ("is an airdrop coming?", "could airdrop", rumors) with no announced campaign or participation steps.
- Listicles, roundups, or historical recaps of past airdrops.
- General project news, funding rounds, partnerships, or exchange listings with no participation campaign.

Input articles (JSON):
${JSON.stringify(inputs, null, 2)}
`.trim();
}

function parseBatchResponse(rawText, expectedSize) {
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error('Batch response missing "results" array');
  }
  const byIdx = new Map();
  for (const r of parsed.results) {
    if (typeof r.idx === 'number') {
      r.trend_score = r.trend_score || r.trust_score || 50;
      byIdx.set(r.idx, r);
    }
  }
  if (byIdx.size === 0) throw new Error('Batch response has no valid idx entries');
  return byIdx;
}

async function runScraper() {
  logger.info('--- Starting Scraper ---');

  const rawItems = await fetchRealData();
  let aiCalls = 0;
  let dropped = 0;
  let skipped = 0;
  let blocked = 0;
  let aiSaved = 0;

  // Phase 1: 분류 라우팅
  //   - blocked → 버림 (차단 출처)
  //   - skip → 버림 (광고/노이즈)
  //   - score < AI_THRESHOLD → 버림 (에어드랍 여부를 신뢰성 있게 판별할 수 없음)
  //   - score >= AI_THRESHOLD → AI 배치로 정밀 분석
  const aiCandidates = [];
  for (const item of rawItems) {
    const blockedCheck = isBlockedSource({ link: item.link, sourceName: item.sourceName });
    if (blockedCheck.blocked) {
      blocked++;
      logger.warn(
        { reason: blockedCheck.reason, matched: blockedCheck.matched, title: item.title },
        '[Blocked source]'
      );
      continue;
    }

    const existingAirdrop = await Airdrop.findOne({ unique_hash: { $eq: item.id } });
    if (existingAirdrop) continue;

    const evaluation = evaluateNews(item);
    if (evaluation.skip) {
      skipped++;
      continue;
    }
    // POSITIVE 시그널이 약하면 AI 호출 없이 버린다 (에어드랍일 가능성이 낮음 + quota 절약)
    if (evaluation.score < AI_THRESHOLD) {
      dropped++;
      continue;
    }
    aiCandidates.push({ item, evaluation });
  }

  // Phase 2: AI 후보를 BATCH_SIZE 단위로 분석. 에어드랍으로 확정된 항목만 저장.
  for (let i = 0; i < aiCandidates.length; i += BATCH_SIZE) {
    const slice = aiCandidates.slice(i, i + BATCH_SIZE);
    const batch = slice.map((s) => s.item);
    let byIdx;
    try {
      aiCalls++;
      const result = await model.generateContent(buildBatchPrompt(batch), {
        responseMimeType: 'application/json',
      });
      const response = await result.response;
      byIdx = parseBatchResponse(response.text(), batch.length);
      if (i + BATCH_SIZE < aiCandidates.length) await sleep(5000);
    } catch (error) {
      logger.error({ err: error }, 'Gemini batch API failed');
      // 배치 실패 → 이 묶음은 저장하지 않고 버린다 (다음 cron에서 재시도)
      dropped += slice.length;
      continue;
    }

    for (let j = 0; j < slice.length; j++) {
      const { item } = slice[j];
      const aiResult = byIdx.get(j);
      if (!aiResult) {
        dropped++;
        continue;
      }
      if (aiResult.is_scam === true) continue;
      await saveAiResult(item, aiResult);
      if (aiResult.is_airdrop) aiSaved++;
    }
  }

  const stats = {
    items: rawItems.length,
    aiCalls,
    aiSaved,
    dropped,
    skipped,
    blocked,
    finishedAt: new Date().toISOString(),
  };
  logger.info(stats, '--- Scraper finished ---');
  return stats;
}

module.exports = {
  runScraper,
  fetchRealData,
  evaluateNews,
  shouldDemoteAirdrop,
  SKIP_THRESHOLD,
  AI_THRESHOLD,
  BATCH_SIZE,
};
