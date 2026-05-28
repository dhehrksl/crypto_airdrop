// 커뮤니티 게시글 (Reddit/Telegram/임의 URL) → AI 구조 추출 → AirdropDraft 저장.
// 기존 scraper와 분리 — scraper는 "에어드랍 vs 뉴스" 이진 분류가 목적이고,
// 이 모듈은 "참여 가능한 에어드랍이라면 단계/마감/토큰을 뽑아내는" 게 목적.
//
// 워크플로:
//   1) raw item들을 BATCH_SIZE만큼 묶음
//   2) Gemini에 구조화 JSON 추출 요청 (tasks[], end_date, tokenTicker, ...)
//   3) 유효한 결과만 AirdropDraft에 upsert (unique_hash로 중복 방지)
//   4) 관리자가 별도 화면에서 검토 후 Airdrop 컬렉션으로 승격

const crypto = require('crypto');
const AirdropDraft = require('../../models/AirdropDraft');
const Airdrop = require('../../models/Airdrop');
const { isBlockedSource } = require('../config/blockedSources');
const { isOfficialTelegramSource } = require('../config/officialTelegramChannels');
const logger = require('../lib/logger');
const geminiClient = require('./geminiClient');

// 호출 횟수 최소화 — 큰 batch + 긴 간격으로 quota 보존.
// 분당 input token 한도(1M)에 안 닿도록 입력 길이도 절약(아래 buildPrompt).
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 15000;

// 거래소 캠페인(선물/마진/레버리지 거래 요구) 차단 — 손실 위험이 크고 에어드랍이라기보다 거래소 마케팅에 가까움.
// 영문/한글 키워드 모두 매치. category, tasks, description, title 어느 곳에 있어도 거름.
const TRADING_EXCLUSION_REGEX =
  /\b(futures?|perpetual|perp\b|margin|leverage(d)?|long[\s-]?short|derivatives?|liquidation)\b|선물|마진|레버리지|롱숏|파생/i;

function containsTradingKeyword(payload) {
  const parts = [
    payload.title || '',
    payload.description || '',
    payload.category || '',
    ...(Array.isArray(payload.tasks) ? payload.tasks : []),
  ];
  return TRADING_EXCLUSION_REGEX.test(parts.join('\n'));
}

function buildPrompt(batch) {
  // 입력 토큰 절약 — content를 500자로 자름. 에어드랍 메타데이터(프로젝트명·단계·마감)는
  // 대부분 첫 500자 내에 있으므로 정확도 손실 미미.
  const inputs = batch.map((item, idx) => ({
    idx,
    title: item.title || '',
    content: (item.content || '').slice(0, 500),
    source: item.sourceName || '',
    link: item.link || '',
  }));
  const todayISO = new Date().toISOString().slice(0, 10);
  return `
You are a crypto airdrop curator. Today: ${todayISO}.
Analyze these ${batch.length} community posts (Reddit/Telegram/URL) and extract STRUCTURED airdrop data for each.

INPUT (JSON):
${JSON.stringify(inputs, null, 2)}

For each input, decide if it describes an ACTIONABLE airdrop campaign that a user can participate in RIGHT NOW or VERY SOON. If yes, extract the structure. If no, mark is_airdrop=false and we'll discard it.

Respond ONLY with JSON (no markdown):
{
  "results": [
    {
      "idx": <integer matching input idx>,
      "is_airdrop": <boolean>,
      "is_scam_suspect": <boolean — true for obvious scams: seed phrase requests, fake-looking sites, "send X get Y" patterns>,
      "title": "<한국어 제목 (간결, 핵심 프로젝트명 포함)>",
      "description": "<한국어 2~3문장 요약 — 이 에어드랍이 무엇이며 왜 참여할 만한지>",
      "tasks": ["<참여 단계 1>", "<참여 단계 2>", ...],
      "tokenTicker": "<예: JUP, ETHFI — 모르면 null>",
      "category": "<예: Layer2, Restaking, DePIN, Testnet — 모르면 null>",
      "chain": ["<예: Ethereum, Solana — 모르면 빈 배열>"],
      "end_date": "<ISO 8601 — 본문에 마감일 명시되어 있으면 추출, 모르면 null>",
      "official_link": "<참여 가능한 공식 사이트 URL. 본문에서 공식 도메인 우선 추출. 없으면 input link>",
      "trend_score": <0~100 정수. 명확한 단계+공식링크+활성기간이면 80+, 추측성/불완전이면 50~70>
    }
  ]
}

RULES — is_airdrop=true 조건:
  (a) 특정 프로젝트 + 토큰/포인트 프로그램이 명시되어 있다
  (b) 캠페인이 현재 활성이거나 곧 시작 (과거에 끝난 것 X)
  (c) 구체적 참여 단계가 추론 가능하다 (지갑 연결, 테스트넷 사용, 거래, 홀딩 등)

is_airdrop=false 처리:
  - 가격/시장 분석, 규제 뉴스, 펀딩 라운드, 해킹/스캠 보고
  - 이미 끝난 에어드랍의 회고/순위 정리
  - "곧 에어드랍 올 듯" 추측만 있고 단계 없음
  - 의미 없는 채팅/광고 ("이거 살래?", "투자 권유")
  - **선물/마진/레버리지/파생상품 거래 요구 캠페인** (Coinlocally식 futures 보상 등) —
    이건 거래소 마케팅이지 에어드랍이 아님. 손실 위험 크니 무조건 false.
    "futures", "perpetual", "perp", "margin", "leverage", "long/short", "derivatives",
    "선물", "마진", "레버리지", "롱숏", "파생" 키워드가 있으면 false.

RULES — tasks 추출:
  - 본문이 명확한 단계를 제시하면 그대로 (3~7단계 권장)
  - 모호하면 일반화된 단계로 ("프로젝트 사이트 접속", "지갑 연결", "에어드랍 페이지에서 자격 확인")
  - 한국어로. 동사형 종결 ("~하기" 또는 "~한다")
  - 단계가 1개 이하로만 추론되면 is_airdrop=false (참여 정보 부족)

RULES — 스캠 가드:
  - "프라이빗 키 입력", "시드 구문 제공", "1 ETH 보내면 2 ETH 보냄" → is_scam_suspect=true, trend_score=0
  - 정체 불명 사이트 도메인 (signdr0p.xyz 등 유사 도메인) → is_scam_suspect=true, trend_score<30

Return EXACTLY ${batch.length} results.
`.trim();
}

function parseResponse(rawText, expectedSize) {
  let cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error('AI response missing "results" array');
  }
  const byIdx = new Map();
  for (const r of parsed.results) {
    if (typeof r.idx === 'number') byIdx.set(r.idx, r);
  }
  if (byIdx.size === 0) throw new Error('AI returned no valid idx entries');
  return byIdx;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizeUrl(url, fallback) {
  if (!url) return fallback || '';
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return fallback || '';
    return u.toString();
  } catch {
    return fallback || '';
  }
}

// 공식 TG 채널 draft를 즉시 Airdrop 컬렉션으로 publish.
// adminDraftController.approveDraft와 동일한 페이로드 구조.
async function publishDraftAsAirdrop(draft) {
  const airdropDoc = {
    title: draft.title,
    description: draft.description,
    official_link: draft.official_link,
    tokenTicker: draft.tokenTicker,
    tasks: Array.isArray(draft.tasks) && draft.tasks.length > 0 ? draft.tasks : undefined,
    end_date: draft.end_date,
    category: draft.category,
    chain: Array.isArray(draft.chain) && draft.chain.length > 0 ? draft.chain : undefined,
    trend_score: draft.trend_score || 70,
    is_confirmed: true,
    is_airdrop: true,
    is_scam: false,
    source: ['curated', draft.source_name].filter(Boolean),
    unique_hash:
      'auto-tg:' +
      crypto.createHash('sha256').update(`${draft.title}|${draft.official_link}`).digest('hex').slice(0, 24),
  };
  return Airdrop.create(airdropDoc);
}

async function saveDraft(item, ai) {
  if (!ai || ai.is_airdrop !== true) return { skipped: true, reason: 'not_airdrop' };
  if (!Array.isArray(ai.tasks) || ai.tasks.length < 2) return { skipped: true, reason: 'no_tasks' };

  const official_link = sanitizeUrl(ai.official_link, item.link);
  if (!official_link) return { skipped: true, reason: 'no_link' };

  const blocked = isBlockedSource({ link: official_link, sourceName: item.sourceName });
  if (blocked.blocked) return { skipped: true, reason: `blocked:${blocked.reason}` };

  // 선물/마진/레버리지 거래 요구 캠페인 차단 — AI가 통과시켜도 키워드 기반 2차 가드
  if (containsTradingKeyword({ title: ai.title, description: ai.description, category: ai.category, tasks: ai.tasks })) {
    return { skipped: true, reason: 'futures_or_margin_excluded' };
  }

  // 이미 존재하면 skip — 운영자가 처리한 항목을 자동 수집이 덮어쓰는 것 방지
  const existing = await AirdropDraft.findOne({ unique_hash: item.id }).lean();
  if (existing) return { skipped: true, reason: 'duplicate', status: existing.status };

  // 공식 TG 채널이면 자동 승인 + 즉시 Airdrop publish.
  // is_scam_suspect 표시된 항목은 안전상 자동 publish 제외 (pending으로 떨어뜨림).
  const isOfficial = isOfficialTelegramSource(item.sourceName) && !ai.is_scam_suspect;

  const payload = {
    title: String(ai.title || item.title).trim().slice(0, 300),
    description: String(ai.description || '').trim().slice(0, 4000),
    official_link: official_link.slice(0, 600),
    tokenTicker: ai.tokenTicker ? String(ai.tokenTicker).trim().toUpperCase().slice(0, 20) : undefined,
    tasks: ai.tasks.map((t) => String(t).trim()).filter(Boolean).slice(0, 12),
    end_date: undefined,
    category: ai.category ? String(ai.category).trim().slice(0, 60) : undefined,
    chain: Array.isArray(ai.chain) && ai.chain.length > 0 ? ai.chain.map((c) => String(c).trim()).filter(Boolean) : undefined,
    trend_score: Number.isFinite(Number(ai.trend_score)) ? Math.min(100, Math.max(0, Number(ai.trend_score))) : 70,
    is_scam_suspect: !!ai.is_scam_suspect,
    source_name: item.sourceName || 'unknown',
    source_url: item.link,
    source_excerpt: (item.content || '').slice(0, 1500),
    unique_hash: item.id,
    status: isOfficial ? 'approved' : 'pending',
    reviewNote: isOfficial ? 'auto-approved: official TG channel' : undefined,
    reviewedAt: isOfficial ? new Date() : undefined,
  };
  if (ai.end_date) {
    const d = new Date(ai.end_date);
    if (!isNaN(d.getTime())) payload.end_date = d;
  }

  const draft = await AirdropDraft.create(payload);

  if (isOfficial) {
    try {
      const airdrop = await publishDraftAsAirdrop(draft);
      draft.publishedAirdrop = airdrop._id;
      await draft.save();
      return { skipped: false, autoPublished: true };
    } catch (e) {
      logger.error({ err: e, draftId: draft._id }, '[auto-publish] failed — left as approved draft');
      return { skipped: false, autoPublished: false, error: e.message };
    }
  }

  return { skipped: false };
}

async function extractAndSaveBatch(items) {
  const stats = { total: items.length, saved: 0, skipped: 0, errors: 0, aiCalls: 0, reasons: {} };

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    let byIdx;
    try {
      stats.aiCalls++;
      const { result } = await geminiClient.generateContent(buildPrompt(batch), {
        responseMimeType: 'application/json',
      });
      byIdx = parseResponse((await result.response).text(), batch.length);
    } catch (e) {
      logger.error({ err: e }, '[Draft AI] batch failed');
      stats.errors += batch.length;
      continue;
    }
    for (let j = 0; j < batch.length; j++) {
      const ai = byIdx.get(j);
      const item = batch[j];
      try {
        const r = await saveDraft(item, ai);
        if (r.skipped) {
          stats.skipped++;
          stats.reasons[r.reason] = (stats.reasons[r.reason] || 0) + 1;
        } else {
          stats.saved++;
        }
      } catch (e) {
        logger.error({ err: e }, '[Draft AI] save failed');
        stats.errors++;
      }
    }
    if (i + BATCH_SIZE < items.length) await sleep(BATCH_DELAY_MS);
  }
  return stats;
}

// 단일 아이템 (URL 붙여넣기) 즉시 처리
async function extractSingle(item) {
  const { result } = await geminiClient.generateContent(buildPrompt([item]), {
    responseMimeType: 'application/json',
  });
  const byIdx = parseResponse((await result.response).text(), 1);
  const ai = byIdx.get(0);
  if (!ai) throw new Error('AI returned no result');
  if (ai.is_airdrop !== true) {
    return { saved: false, reason: 'AI가 액션 가능한 에어드랍으로 판단하지 않았습니다.', ai };
  }
  const r = await saveDraft(item, ai);
  if (r.skipped) return { saved: false, reason: r.reason, ai };
  return { saved: true, ai };
}

module.exports = { extractAndSaveBatch, extractSingle };
