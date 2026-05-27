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

// === 법무 정책 ===
// 일반 뉴스 매체(CoinTelegraph, Decrypt, NewsBTC 등) RSS는 제거.
// 이유: 광고 수익 앱이라 commercial reuse 회색지대 + 콘텐츠 저작권 위험.
// 대신 1차 출처(프로젝트 공식 블로그, 거버넌스 포럼, 공식 Medium publication)만 수집.
// Medium 태그 피드(일반 사용자 글)는 발견용으로 유지하되 화면에는 노출되지 않음(is_confirmed=false).
const RSS_SOURCES = [
  // === 프로젝트 공식 블로그 (자동 is_confirmed=true) ===
  // RSS 살아있는 것만 유지. 죽은 것(Optimism Mirror, Cosmos, Injective, Jito, Jupiter, Aptos forum)은 제거.
  { name: 'Blog-Celestia', url: 'https://blog.celestia.org/rss/' },
  { name: 'Blog-Ethereum', url: 'https://blog.ethereum.org/feed.xml' },
  { name: 'Blog-Sui', url: 'https://blog.sui.io/rss/' },
  { name: 'Blog-EigenLayer', url: 'https://blog.eigenlayer.xyz/rss/' },
  { name: 'Blog-Uniswap', url: 'https://blog.uniswap.org/rss.xml' },
  { name: 'Blog-Lido', url: 'https://blog.lido.fi/rss/' },
  { name: 'Blog-Polygon', url: 'https://polygon.technology/blog-rss.xml' },
  { name: 'Blog-zkSync', url: 'https://blog.zksync.io/rss/' },
  { name: 'Blog-Scroll', url: 'https://scroll.io/blog/rss' },
  { name: 'Blog-Berachain', url: 'https://blog.berachain.com/rss/' },
  { name: 'Blog-Linea', url: 'https://linea.mirror.xyz/feed/atom' },
  { name: 'Blog-Solana', url: 'https://solana.com/news/rss.xml' },

  // === 거버넌스 포럼 (Discourse 표준 RSS) ===
  { name: 'Forum-Arbitrum', url: 'https://forum.arbitrum.foundation/latest.rss' },
  { name: 'Forum-Optimism', url: 'https://gov.optimism.io/latest.rss' },
  { name: 'Forum-Celestia', url: 'https://forum.celestia.org/latest.rss' },
  { name: 'Forum-Aave', url: 'https://governance.aave.com/latest.rss' },
  { name: 'Forum-MakerDAO', url: 'https://forum.makerdao.com/latest.rss' },
  { name: 'Forum-Compound', url: 'https://www.comp.xyz/latest.rss' },
  { name: 'Forum-Polygon', url: 'https://forum.polygon.technology/latest.rss' },
  { name: 'Forum-Uniswap', url: 'https://gov.uniswap.org/latest.rss' },
  { name: 'Forum-Lido', url: 'https://research.lido.fi/latest.rss' },
  { name: 'Forum-Berachain', url: 'https://forum.berachain.com/latest.rss' },

  // === Medium 공식 publication (자동 is_confirmed=true) ===
  { name: 'Medium-StarkWare', url: 'https://medium.com/feed/@starkware' },
  { name: 'Medium-AaveProtocol', url: 'https://medium.com/feed/@aave' },
  { name: 'Medium-AptosLabs', url: 'https://aptoslabs.medium.com/feed' },
  { name: 'Medium-TonCommunity', url: 'https://medium.com/feed/@toncommunity' },
  { name: 'Medium-Polygon', url: 'https://medium.com/feed/@polygon_technology' },
  { name: 'Medium-1inch', url: 'https://medium.com/feed/@1inch.io' },
  { name: 'Medium-Pendle', url: 'https://medium.com/feed/@pendle_finance' },
  { name: 'Medium-Cosmos', url: 'https://medium.com/feed/@cosmos' },

  // === Medium 태그 피드 (발견용 — 화면 노출 X, AI 발견 트리거로만) ===
  // 일반 사용자 글이라 is_confirmed=false 유지. 사용자 화면에는 노출 안 됨.
  // 새 프로젝트/캠페인을 빠르게 발견하는 용도.
  { name: 'Medium-TonBlockchain', url: 'https://medium.com/feed/tag/ton-blockchain' },
  { name: 'Medium-MiniApps', url: 'https://medium.com/feed/tag/telegram-mini-apps' },
  { name: 'Medium-Toncoin', url: 'https://medium.com/feed/tag/toncoin' },
  { name: 'Medium-TapToEarn', url: 'https://medium.com/feed/tag/tap-to-earn' },
  { name: 'Medium-Notcoin', url: 'https://medium.com/feed/tag/notcoin' },
  { name: 'Medium-HamsterKombat', url: 'https://medium.com/feed/tag/hamster-kombat' },
  { name: 'Medium-Catizen', url: 'https://medium.com/feed/tag/catizen' },
  { name: 'Medium-Hyperliquid', url: 'https://medium.com/feed/tag/hyperliquid' },
  { name: 'Medium-Berachain', url: 'https://medium.com/feed/tag/berachain' },
  { name: 'Medium-Monad', url: 'https://medium.com/feed/tag/monad' },
  { name: 'Medium-MonadLabs', url: 'https://medium.com/feed/tag/monad-labs' },
  { name: 'Medium-MegaETH', url: 'https://medium.com/feed/tag/megaeth' },
  { name: 'Medium-Movement', url: 'https://medium.com/feed/tag/movement-labs' },
];

// === 공식 출처 화이트리스트 ===
// 이 도메인에서 온 항목은 saveAiResult에서 is_confirmed=true로 강제 설정한다.
// AI 분류와 별개로 도메인 기반의 신뢰 가능한 1차 출처임을 보장.
const OFFICIAL_DOMAINS = [
  // 프로젝트 자체 도메인
  /^blog\.celestia\.org$/i, /^blog\.ethereum\.org$/i, /^blog\.sui\.io$/i,
  /^blog\.eigenlayer\.xyz$/i, /^blog\.uniswap\.org$/i, /^blog\.lido\.fi$/i,
  /^polygon\.technology$/i, /^blog\.zksync\.io$/i, /^scroll\.io$/i,
  /^blog\.berachain\.com$/i, /^linea\.mirror\.xyz$/i, /^optimism\.mirror\.xyz$/i,
  /^solana\.com$/i, /^blog\.cosmos\.network$/i, /^blog\.injective\.com$/i,
  /^www\.jito\.network$/i, /^blog\.jup\.ag$/i,
  // 거버넌스 포럼 (Discourse 인스턴스)
  /^forum\.arbitrum\.foundation$/i, /^gov\.optimism\.io$/i, /^forum\.celestia\.org$/i,
  /^governance\.aave\.com$/i, /^forum\.makerdao\.com$/i, /^www\.comp\.xyz$/i,
  /^forum\.polygon\.technology$/i, /^gov\.uniswap\.org$/i, /^research\.lido\.fi$/i,
  /^forum\.aptosfoundation\.org$/i, /^forum\.berachain\.com$/i,
  // Snapshot DAO governance
  /^snapshot\.org$/i, /^hub\.snapshot\.org$/i,
];

// Medium 공식 publication (medium.com/@xxx 또는 xxx.medium.com)
const OFFICIAL_MEDIUM_HANDLES = new Set([
  'starkware', 'aave', 'aptoslabs', 'toncommunity', 'theopennetwork',
  'polygon_technology', 'polygon-technology', '1inch.io',
  'pendle_finance', 'cosmos', 'avalancheavax', 'arbitrumfoundation',
]);

function isOfficialSource({ link, sourceName }) {
  if (sourceName && sourceName.startsWith('Snapshot-')) return true;
  if (!link) return false;
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    if (OFFICIAL_DOMAINS.some((re) => re.test(host))) return true;
    if (host === 'medium.com') {
      const m = url.pathname.match(/^\/@?([^/]+)/);
      if (m && OFFICIAL_MEDIUM_HANDLES.has(m[1].toLowerCase().replace(/^@/, ''))) return true;
    }
    if (host.endsWith('.medium.com')) {
      const sub = host.split('.')[0];
      if (OFFICIAL_MEDIUM_HANDLES.has(sub.toLowerCase())) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

const POSITIVE_PATTERNS = [
  /airdrop/i, /claim/i, /snapshot/i, /eligib/i, /testnet/i, /mainnet/i,
  /incentivized/i, /waitlist/i, /points/i, /reward/i, /quest/i, /whitelist/i,
  // 2024~2026 에어드랍 캠페인 키워드
  /tap[\s-]?to[\s-]?earn/i, /mini[\s-]?app/i, /\bTMA\b/, /\bTGE\b/,
  /season\s*\d/i, /pre[\s-]?market/i, /genesis\s+drop/i, /allocation/i,
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
  let lastMediumAt = 0;
  for (const source of RSS_SOURCES) {
    // Medium은 IP/도메인 단위 rate limit이 강해 연속 요청 시 거부됨.
    // medium.com 도메인은 직전 medium 요청과 800ms 이상 간격을 두고 호출.
    if (source.url.includes('medium.com')) {
      const elapsed = Date.now() - lastMediumAt;
      if (elapsed < 800) await sleep(800 - elapsed);
      lastMediumAt = Date.now();
    }
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

  const finalLink = aiResult.official_link || item.link;
  // 화이트리스트 매칭: 공식 도메인 → AI 판단과 무관하게 is_confirmed=true 강제.
  // 코드 기반 도메인 매칭이라 AI hallucination에 흔들리지 않는다.
  const isOfficial = isOfficialSource({ link: finalLink, sourceName: item.sourceName });
  const updateData = {
    title: aiResult.title,
    description: aiResult.description,
    official_link: finalLink,
    trend_score: aiResult.trend_score || 0,
    is_confirmed: isOfficial ? true : (aiResult.is_confirmed || false),
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

=== TON ECOSYSTEM HINT ===
Telegram Mini App campaigns (tap-to-earn, in-app quests with eligibility/claim phase) and TON-native
airdrops qualify as is_airdrop=true when concrete user steps exist (join bot, complete tasks, hold/stake
$TON, wallet connect). Treat $TON, Toncoin, "Mini App", "TMA", "tap-to-earn" as positive signals.

=== is_confirmed 결정 기준 (CRITICAL) ===
Set is_confirmed=true ONLY when the source link points to an OFFICIAL 1st-party source:
- The project's own blog or website (e.g., blog.celestia.org, blog.berachain.com, polygon.technology)
- An official DAO governance forum (Discourse: forum.xxx.org, gov.xxx.org, governance.xxx.com)
- A Snapshot governance proposal (snapshot.org/...)
- An official Medium publication owned by the project team (medium.com/@projectname or projectname.medium.com)

Set is_confirmed=false for:
- News media articles (CoinTelegraph, Decrypt, NewsBTC, etc.) — second-hand reports
- Random user posts on Medium tag feeds (medium.com/feed/tag/xxx with no clear project ownership)
- Aggregator/listing sites or affiliate content
- Personal blogs not affiliated with the project

When uncertain, default to is_confirmed=false. The backend will additionally force is_confirmed=true
for whitelisted official domains, so under-classifying is safe.

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
  buildBatchPrompt,
  parseBatchResponse,
  model,
  RSS_SOURCES,
  SKIP_THRESHOLD,
  AI_THRESHOLD,
  BATCH_SIZE,
};
