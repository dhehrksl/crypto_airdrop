const axios = require('axios');
const RSSParser = require('rss-parser');

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');
const User = require('../../models/User');
const { Expo } = require('expo-server-sdk');
// airdrops.io 스크래퍼는 ToS의 상업적 사용 금지 조항으로 제거됨.
// 자체 큐레이션 + 사용자 제보 시스템으로 대체.
const expo = new Expo();

// 뉴스는 3일 보관 — 그 이상 된 항목은 자동 삭제 (앱 무게 + 신선도)
const NEWS_RETENTION_DAYS = 3;

async function pruneOldNews() {
  const cutoff = new Date(Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await News.deleteMany({ created_at: { $lt: cutoff } });
  if (result.deletedCount > 0) {
    console.log(`[News retention] pruned ${result.deletedCount} items older than ${NEWS_RETENTION_DAYS} days`);
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
  // Existing Sources
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss/tag/airdrop' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Medium-Airdrop', url: 'https://medium.com/feed/tag/airdrop' },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { name: 'NewsBTC', url: 'https://www.newsbtc.com/tag/airdrop/feed/' },
  { name: 'TokenPost', url: 'https://tokenpost.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed/' },

  // Newly Added Sources
  { name: 'The Block', url: 'https://theblock.co/rss.xml' },
  { name: 'Bitcoin.com News', url: 'https://news.bitcoin.com/feed' },
  // CryptoNews / CryptoPanic / Bitcoinist / Forbes: fetch 지속 실패 (URL 변경 또는 차단 추정).
  // URL 확인 후 부활시키려면 주석 해제하세요.
  // { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed' },
  // { name: 'CryptoPanic', url: 'https://cryptopanic.com/news/rss' },
  { name: 'U.Today', url: 'https://u.today/rss' },
  // { name: 'Bitcoinist', url: 'https://bitcoinist.com/feed' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed/' },
  { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed' },
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
      const reason = error.status ? `Status ${error.status}` : "Fetch/Parse Error";
      console.warn(`[Skip Source] ${source.name}: ${reason}`);
    }
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
    try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { console.error(e); }
  }
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// 휴리스틱 점수 임계값
// score < SKIP_THRESHOLD            : 완전히 버림 (저장도 안 함)
// SKIP_THRESHOLD ≤ score < AI_THRESHOLD : 휴리스틱 결과만 저장 (AI 호출 안 함) → News로 저장
// score ≥ AI_THRESHOLD              : AI 호출하여 정밀 분석 (배치 처리)
//
// NEGATIVE 패턴이 광고/노이즈만 거르므로, 일반 암호화폐 뉴스를 흡수하기 위해 SKIP=0.
// AI 호출은 에어드랍 키워드가 있는 항목(점수 5+)에만 — 비용 통제.
const SKIP_THRESHOLD = 0;
const AI_THRESHOLD = 5;
// 한 번의 generateContent 호출에 묶을 항목 수.
// 토큰 사용량 / 응답 길이 / 모델 혼동 위험을 고려해 10이 안전한 기본값.
const BATCH_SIZE = 10;

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

async function saveAiResult(item, aiResult) {
  if (!aiResult || aiResult.is_scam === true) return;
  if (aiResult.is_airdrop) {
    const updateData = {
      title: aiResult.title,
      description: aiResult.description,
      official_link: aiResult.official_link || item.link,
      trust_score: aiResult.trust_score || 0,
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
    if (updateData.trust_score >= 90) await sendPushNotifications(newA);
    console.log(`Saved Airdrop: ${aiResult.title} (Score: ${aiResult.trust_score})`);
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
    console.log(`Saved News: ${aiResult.title}`);
  }
}

function buildBatchPrompt(batch) {
  const inputs = batch.map((item, idx) => ({
    idx,
    title: item.title,
    // 토큰 절약 — 본문은 800자까지만
    content: (item.content || '').slice(0, 800),
    link: item.link,
  }));
  return `
You are a cryptocurrency airdrop analyst. Analyze the ${batch.length} articles in the input below.
For each article: (1) decide if it is an actionable, currently-claimable airdrop CAMPAIGN that users can participate in,
(2) detect scams, (3) translate title and description into Korean.

Input articles (JSON):
${JSON.stringify(inputs, null, 2)}

Respond ONLY with a JSON object with this EXACT structure (no markdown, no explanation):
{
  "results": [
    {
      "idx": <integer matching input idx>,
      "is_airdrop": <boolean>,
      "is_scam": <boolean>,
      "title": "<한국어로 번역된 제목>",
      "description": "<한국어로 정확히 3문장 요약. 에어드랍이면 참여 방법/조건/마감 위주, 뉴스면 핵심 사실 위주>",
      "trust_score": <integer 0-100, 0 if scam>,
      "official_link": "<best official URL, fall back to input link if unknown>",
      "end_date": "<ISO 8601 datetime or null>"
    }
  ]
}

=== STRICT RULES FOR is_airdrop ===
Set is_airdrop=true ONLY when ALL of these hold:
  (a) The article is about a SPECIFIC airdrop campaign (named project + token or points program).
  (b) The campaign is currently LIVE, OPEN FOR SIGN-UP, or starts in the near future (not yet ended).
  (c) The article tells the reader concrete steps to participate (e.g. connect wallet, complete quests,
      bridge funds, hold a token, register on a site).

Set is_airdrop=FALSE in ALL of these cases (these are news, not actionable airdrops):
  - Article reports on the AFTERMATH of an airdrop that already happened
    (token launch, post-distribution price movement, market reaction, value drop/surge after claim).
  - Article discusses price predictions, market analysis, ETF news, regulation, lawsuits, hacks,
    funding rounds, ecosystem updates, opinion pieces, or general project news.
  - Article only speculates that an airdrop "might come" with no concrete participation steps.
  - Article ranks past airdrops, lists historical airdrops, or summarizes the year's airdrops.
  - Article is a generic guide or educational explainer about airdrops as a concept.

Examples of titles that MUST be is_airdrop=false (these are all news):
  - "Wormhole's $617M airdrop sparks 23% W price drop"  (aftermath/market reaction)
  - "EtherFi airdrop sparks market turbulence, ETHFI drops 35%"  (aftermath)
  - "How a new development could stop OP price rally"  (price analysis)
  - "Top 13 airdrops that distributed $4B in 2023"  (historical ranking)
  - "LayerZero crosses milestone — is an airdrop coming?"  (speculation, no steps)

=== OTHER RULES ===
- "title" and "description" MUST be in Korean. NEVER leave them in English.
- Return EXACTLY ${batch.length} results, one per input idx, in order.
- If unsure about end_date, return null. Do not fabricate dates.
- If the article asks for private keys/seed phrases or links to suspicious wallets, set is_scam=true and trust_score=0.
- For is_airdrop=false items, set trust_score=0 (trust score is only meaningful for actionable airdrops).
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
    if (typeof r.idx === 'number') byIdx.set(r.idx, r);
  }
  if (byIdx.size === 0) throw new Error('Batch response has no valid idx entries');
  // 일부 누락은 허용 (호출자가 idx 기반 매칭하여 누락분은 휴리스틱 fallback)
  if (byIdx.size < expectedSize) {
    console.warn(`Batch partial: got ${byIdx.size}/${expectedSize} results`);
  }
  return byIdx;
}

async function runScraper() {
  console.log('--- Starting Scraper ---');

  // 오래된 뉴스 정리
  let prunedNews = 0;
  try {
    prunedNews = await pruneOldNews();
  } catch (err) {
    console.error('News retention pruning failed:', err.message || err);
  }

  const rawItems = await fetchRealData();
  let aiCalls = 0;
  let heuristicSaves = 0;
  let skipped = 0;
  let aiSaved = 0;

  // Phase 1: 사전 분류 — DB 중복 제거. 모든 신규 항목은 AI로 분류+번역 처리.
  // (휴리스틱은 NEGATIVE 패턴 매칭으로 광고/노이즈만 거름. 점수에 따른 차등 없음.)
  const aiCandidates = [];
  for (const item of rawItems) {
    const existingAirdrop = await Airdrop.findOne({ unique_hash: { $eq: item.id } });
    const existingNews = await News.findOne({ unique_hash: { $eq: item.id } });
    if (existingAirdrop || existingNews) continue;

    const evaluation = evaluateNews(item);
    if (evaluation.skip) {
      skipped++;
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
      console.error('Gemini batch API Error:', error.message || error);
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
    prunedNews,
    finishedAt: new Date().toISOString(),
  };
  console.log(
    `--- Finished --- (items=${stats.items}, aiCalls=${stats.aiCalls}, aiSaved=${stats.aiSaved}, heuristic=${stats.heuristic}, skipped=${stats.skipped}, prunedNews=${prunedNews})`
  );
  return stats;
}
module.exports = { runScraper, fetchRealData, evaluateNews, pruneOldNews, SKIP_THRESHOLD, AI_THRESHOLD, BATCH_SIZE };
