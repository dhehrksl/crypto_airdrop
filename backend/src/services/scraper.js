const axios = require('axios');
const RSSParser = require('rss-parser');

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');
const User = require('../../models/User');
const logger = require('../lib/logger');
// expo-server-sdk v6는 ESM-only — sendPushNotifications 내부에서 dynamic import.
const { isBlockedSource } = require('../config/blockedSources');
const { fetchSnapshotProposals } = require('./snapshotSource');
// airdrops.io 스크래퍼는 ToS의 상업적 사용 금지 조항으로 제거됨.
// 자체 큐레이션 + 사용자 제보 시스템으로 대체.

// 뉴스는 3일 보관 — 그 이상 된 항목은 자동 삭제 (앱 무게 + 신선도)
const NEWS_RETENTION_DAYS = 3;

async function pruneOldNews() {
  const cutoff = new Date(Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await News.deleteMany({ created_at: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    logger.info({ deleted: result.deletedCount, days: NEWS_RETENTION_DAYS }, '[News retention] pruned old items');
  }
  return result.deletedCount;
}

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
  // airdrop 태그는 이미 위에 있음. 토픽별 분산으로 새 캠페인 발견율 ↑
  { name: 'Medium-Restaking', url: 'https://medium.com/feed/tag/restaking' },
  { name: 'Medium-EigenLayer', url: 'https://medium.com/feed/tag/eigenlayer' },
  { name: 'Medium-ZKRollup', url: 'https://medium.com/feed/tag/zk-rollup' },
  { name: 'Medium-Layer2', url: 'https://medium.com/feed/tag/layer-2' },
  { name: 'Medium-DePIN', url: 'https://medium.com/feed/tag/depin' },
  { name: 'Medium-Testnet', url: 'https://medium.com/feed/tag/testnet' },

  // === 거버넌스 포럼 (Discourse 기본 RSS) ===
  // 토큰 분배/에어드랍 제안이 가장 먼저 올라오는 곳
  { name: 'Forum-Arbitrum', url: 'https://forum.arbitrum.foundation/latest.rss' },
  { name: 'Forum-Optimism', url: 'https://gov.optimism.io/latest.rss' },
  { name: 'Forum-Celestia', url: 'https://forum.celestia.org/latest.rss' },

  // === 프로젝트 공식 블로그 (RSS는 발행자가 명시적으로 공개한 채널 — 가장 안전한 출처) ===
  // L1 / L2 / 인프라 위주.
  { name: 'Blog-Celestia', url: 'https://blog.celestia.org/rss/' },
  { name: 'Blog-Ethereum', url: 'https://blog.ethereum.org/feed.xml' },
  { name: 'Blog-Sui', url: 'https://blog.sui.io/rss/' },
  { name: 'Blog-EigenLayer', url: 'https://blog.eigenlayer.xyz/rss/' },
  { name: 'Blog-Thirdweb', url: 'https://blog.thirdweb.com/rss/' },
  // fetch 실패 — URL 변경 추정. 정확한 RSS 경로 확인 후 부활:
  // { name: 'Blog-Optimism', url: 'https://blog.optimism.io/rss/' },
  // { name: 'Blog-Scroll', url: 'https://scroll.io/blog/rss.xml' },

  // === Medium 공식 publication (web3 프로젝트의 발표 채널) ===
  // Medium은 `@<account>/feed` 또는 `<publication>/feed` 패턴으로 RSS 표준 제공
  { name: 'Medium-StarkWare', url: 'https://medium.com/feed/@starkware' },
  { name: 'Medium-AaveProtocol', url: 'https://medium.com/feed/@aave' },
  { name: 'Medium-AptosLabs', url: 'https://aptoslabs.medium.com/feed' },
  // fetch 실패 — 계정명/publication 변경 추정:
  // { name: 'Medium-OffchainLabs', url: 'https://medium.com/offchainlabs/feed' },
  // { name: 'Medium-LayerZero', url: 'https://medium.com/feed/@layerzero_official' },

  // === 비활성 (URL 변경/차단으로 fetch 실패 — URL 확인 후 부활) ===
  // { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed' },
  // { name: 'CryptoPanic', url: 'https://cryptopanic.com/news/rss' },
  // { name: 'Bitcoinist', url: 'https://bitcoinist.com/feed' },
  // { name: 'Forbes Crypto', url: 'https://www.forbes.com/digital-assets/feed/' },
];

const POSITIVE_PATTERNS = [
  /airdrop/i, /claim/i, /snapshot/i, /eligib/i, /testnet/i, /mainnet/i, 
  /incentivized/i, /waitlist/i, /points/i, /reward/i, /quest/i, /whitelist/i
];

// 일반 암호화폐 뉴스도 흡수할 수 있도록 NEGATIVE는 광고/잡음만 거름.
// 'lawsuit/hack/SEC/court/regulation/ETF/scandal/exploit/bankruptcy/whale/funding/investment' 는
// 실제 암호화폐 뉴스에서 흔히 등장하는 정상 단어이므로 제외하면 안 됨.
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
        id: String(item.guid || item.link), // Added String() conversion for Mongoose CastError fix
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
// 기본 모델 gemini-2.5-flash-lite — 무료 tier 1,500 RPD / 30 RPM / 1M TPM
// (gemini-2.5-flash는 무료 20 RPD로 매시 cron에 부족함. 텍스트 분류/요약 정확도는 lite로 충분.)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// 휴리스틱 점수 임계값
// score < SKIP_THRESHOLD            : 완전히 버림 (저장도 안 함)
// SKIP_THRESHOLD ≤ score < AI_THRESHOLD : 휴리스틱 결과만 저장 (AI 호출 안 함) → News로 저장
// score ≥ AI_THRESHOLD              : AI 호출하여 정밀 분석 (배치 처리)
//
// NEGATIVE는 광고/노이즈만 거르고, POSITIVE 시그널이 없는 일반 뉴스는 휴리스틱으로 News에 직접
// 저장한다(AI 호출 비용 통제). title 매치 1회만 있어도 10점 → AI로 감.
const SKIP_THRESHOLD = 0;
const AI_THRESHOLD = 5;
// 한 번의 generateContent 호출에 묶을 항목 수.
// gemini-2.5-flash-lite 응답 길이 여유 고려해 20으로 확대 (10 → 20).
const BATCH_SIZE = 20;

async function saveHeuristic(item, evaluation) {
  // 휴리스틱(키워드 매칭) 단독으로는 에어드랍/뉴스를 신뢰성 있게 구분할 수 없다.
  // (예: "CLARITY Act"가 'reward'/'incentive' 키워드 때문에 점수 받음)
  // 따라서 휴리스틱 분류 항목은 모두 News로 저장한다. Airdrop 분류는 AI 검증을 거친 항목만.
  const snippet = (item.content || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const description = snippet || '원문 링크에서 상세 내용을 확인하세요.';
  await News.findOneAndUpdate(
    { unique_hash: { $eq: item.id } },
    {
      $set: {
        title: item.title,
        description,
        official_link: item.link,
        source: [item.sourceName],
        unique_hash: item.id,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

// AI가 "활성 에어드랍"으로 분류했지만 사실은 이미 끝난 경우를 잡아내는 사후 검증.
// 반환값: { demote: boolean, reason?: string, parsedEndDate?: Date }
//
// - end_date 파싱 결과가 현재보다 1시간 이상 과거 → demote (시각 정밀도 + clock drift 여유)
// - end_date 누락 + 본문에 종결 키워드 → demote (task 2.3)
const POST_AIRDROP_GUARD_GRACE_MS = 60 * 60 * 1000; // 1시간
const ENDED_KEYWORDS_REGEX =
  /\b(airdrop\s+(has\s+)?ended|distribution\s+(is\s+)?complete|claim\s+period\s+closed|claim\s+window\s+closed|tokens\s+have\s+been\s+distributed|snapshot\s+(was|has been)\s+taken)\b/i;

function shouldDemoteAirdrop(aiResult, item) {
  if (!aiResult || aiResult.is_airdrop !== true) return { demote: false };

  if (aiResult.end_date) {
    const d = new Date(aiResult.end_date);
    if (!isNaN(d.getTime())) {
      if (d.getTime() < Date.now() - POST_AIRDROP_GUARD_GRACE_MS) {
        return { demote: true, reason: 'past_end_date', parsedEndDate: d };
      }
      // 파싱 가능 + 미래 → 통과
      return { demote: false, parsedEndDate: d };
    }
  }

  // end_date 누락 — 본문에 종결 키워드가 있는지 확인 (영문 RSS 기준)
  const haystack = `${item.title || ''}\n${item.content || ''}`;
  if (ENDED_KEYWORDS_REGEX.test(haystack)) {
    return { demote: true, reason: 'ended_keyword_in_body' };
  }

  return { demote: false };
}

async function saveAiResult(item, aiResult) {
  if (!aiResult || aiResult.is_scam === true) return;

  // 사후 검증 — 이미 끝난 에어드랍을 News로 강등
  const check = shouldDemoteAirdrop(aiResult, item);
  if (check.demote) {
    logger.warn(
      { title: aiResult.title, reason: check.reason, parsedEndDate: check.parsedEndDate || null },
      '[AI post-check] demoted to News'
    );
    aiResult = { ...aiResult, is_airdrop: false, trend_score: 0 };
  }

  if (aiResult.is_airdrop) {
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
    // 같은 unique_hash가 휴리스틱 단계에서 News로 먼저 저장됐을 수 있음 — 이중 노출 방지
    await News.deleteOne({ unique_hash: { $eq: item.id } });
    if (updateData.trend_score >= 90) await sendPushNotifications(newA);
    logger.info({ title: aiResult.title, score: aiResult.trend_score }, 'saved Airdrop');
  } else {
    const newsData = {
      title: aiResult.title,
      description: aiResult.description,
      official_link: aiResult.official_link || item.link,
      source: [item.sourceName],
      unique_hash: item.id,
    };
    await News.findOneAndUpdate(
      { unique_hash: { $eq: item.id } },
      { $set: newsData },
      { upsert: true, setDefaultsOnInsert: true }
    );
    // AI가 "에어드랍 아니다"로 판정 → 이전에 잘못 분류돼 Airdrop에 들어간 게 있다면 제거
    await Airdrop.deleteOne({ unique_hash: { $eq: item.id }, source: { $ne: 'airdrops.io' } });
    logger.info({ title: aiResult.title }, 'saved News');
  }
}

function buildBatchPrompt(batch) {
  const inputs = batch.map((item, idx) => ({
    idx,
    title: item.title,
    // 토큰 절약 — 본문은 600자까지만 (요약용)
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
Set is_airdrop=true ONLY when the article discusses a specific, currently active or upcoming token/points campaign with participation steps.

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
      // DB 필드명 trend_score로 매핑
      r.trend_score = r.trend_score || r.trust_score || 50;
      byIdx.set(r.idx, r);
    }
  }
  if (byIdx.size === 0) throw new Error('Batch response has no valid idx entries');
  return byIdx;
}

async function runScraper() {
  logger.info('--- Starting Scraper ---');

  // 오래된 뉴스 정리
  let prunedNews = 0;
  try {
    prunedNews = await pruneOldNews();
  } catch (err) {
    logger.error({ err }, 'News retention pruning failed');
  }

  const rawItems = await fetchRealData();
  let aiCalls = 0;
  let heuristicSaves = 0;
  let skipped = 0;
  let blocked = 0;
  let aiSaved = 0;

  // Phase 1: 분류 라우팅
  //   - blocked → 버림 (차단 출처)
  //   - skip → 버림 (광고/노이즈)
  //   - score < AI_THRESHOLD → 휴리스틱으로 News에 직접 저장 (AI 호출 안 함)
  //   - score >= AI_THRESHOLD → AI 배치로 정밀 분석
  const aiCandidates = [];
  for (const item of rawItems) {
    // 차단 출처 가드 — DB 조회/AI 호출 비용 전에 거름
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
    const existingNews = await News.findOne({ unique_hash: { $eq: item.id } });
    if (existingAirdrop || existingNews) continue;

    const evaluation = evaluateNews(item);
    if (evaluation.skip) {
      skipped++;
      continue;
    }
    // POSITIVE 시그널이 없으면 AI 호출 없이 휴리스틱으로 News에 직접 저장 (quota 절약)
    if (evaluation.score < AI_THRESHOLD) {
      await saveHeuristic(item, evaluation);
      heuristicSaves++;
      continue;
    }
    aiCandidates.push({ item, evaluation });
  }

  // Phase 2: AI 후보를 BATCH_SIZE 단위로 묶어 한 번에 분석 + 한국어 번역
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
      // 배치당 한 번만 대기 (이전 코드는 항목마다 5초)
      if (i + BATCH_SIZE < aiCandidates.length) await sleep(5000);
    } catch (error) {
      logger.error({ err: error }, 'Gemini batch API failed');
      // 배치 실패 → 이 묶음은 모두 휴리스틱 fallback
      for (const { item, evaluation } of slice) {
        await saveHeuristic(item, evaluation);
        heuristicSaves++;
      }
      continue;
    }

    for (let j = 0; j < slice.length; j++) {
      const { item, evaluation } = slice[j];
      const aiResult = byIdx.get(j);
      if (!aiResult) {
        // 부분 누락분은 휴리스틱 fallback
        await saveHeuristic(item, evaluation);
        heuristicSaves++;
        continue;
      }
      if (aiResult.is_scam === true) continue;
      await saveAiResult(item, aiResult);
      aiSaved++;
    }
  }

  const stats = {
    items: rawItems.length,
    aiCalls,
    aiSaved,
    heuristic: heuristicSaves,
    skipped,
    blocked,
    prunedNews,
    finishedAt: new Date().toISOString(),
  };
  logger.info(stats, '--- Scraper finished ---');
  return stats;
}
module.exports = {
  runScraper,
  fetchRealData,
  evaluateNews,
  pruneOldNews,
  shouldDemoteAirdrop,
  SKIP_THRESHOLD,
  AI_THRESHOLD,
  BATCH_SIZE,
};
