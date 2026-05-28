// 무료 Gemini 모델 round-robin fallback 클라이언트.
//
// 동작: 모델 리스트를 순서대로 시도. 429/quota/overloaded(503) 에러면 다음 모델로.
//       그 외 에러(400 잘못된 요청, 401 인증 등)는 그대로 throw — 다른 모델로도 안 풀리는 문제.
//
// 한도 추적은 reactive(에러 기반). 모델별 RPM/RPD를 사전에 알기 어렵고
// 프로세스 재시작 시 카운터가 리셋되는 점을 고려한 단순화.
//
// env:
//   GEMINI_API_KEY            — 필수
//   GEMINI_MODELS             — 콤마 구분 모델 리스트 (선택, 미설정 시 DEFAULT_MODELS)
//
// 사용:
//   const { generateContent } = require('./geminiClient');
//   const { result, modelUsed } = await generateContent(promptText, { responseMimeType: 'application/json' });
//   const text = (await result.response).text();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../lib/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 무료 한도 큰 순서로 정렬 (2026-01 기준 — 실제 한도는 Google AI Studio 콘솔 확인).
//   2.5-flash-lite : ~1000 RPD, 15 RPM
//   2.0-flash-lite : ~1500 RPD, 30 RPM
//   2.0-flash      : ~1500 RPD, 15 RPM
//   2.5-flash      : ~250 RPD, 10 RPM (품질 백업)
const DEFAULT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

function parseModels() {
  const raw = process.env.GEMINI_MODELS;
  if (raw && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_MODELS;
}

let _genAI = null;
const _modelCache = new Map();

function getGenAI() {
  if (_genAI) return _genAI;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY not configured');
  }
  _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return _genAI;
}

function getModel(name) {
  if (_modelCache.has(name)) return _modelCache.get(name);
  const m = getGenAI().getGenerativeModel({ model: name });
  _modelCache.set(name, m);
  return m;
}

// 다음 모델로 넘겨도 풀릴 가능성이 있는 에러만 fallback 처리.
// 잘못된 prompt/요청 형식 같은 에러는 어느 모델에서도 똑같이 실패할 테니 즉시 throw.
function isFallbackEligibleError(err) {
  const msg = String(err?.message || '');
  if (msg.includes('429')) return true;                 // rate limit
  if (msg.includes('RESOURCE_EXHAUSTED')) return true;  // daily quota
  if (/\bquota\b/i.test(msg)) return true;
  if (msg.includes('503')) return true;                 // 서버 일시 과부하 — Gemini 자주 발생
  if (/overloaded/i.test(msg)) return true;
  return false;
}

async function generateContent(prompt, requestOptions) {
  const models = parseModels();
  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    const name = models[i];
    try {
      const m = getModel(name);
      const result = await m.generateContent(prompt, requestOptions);
      if (i > 0) {
        logger.info({ model: name, fellBackFrom: models[0] }, '[Gemini] fallback succeeded');
      }
      return { result, modelUsed: name };
    } catch (err) {
      if (isFallbackEligibleError(err)) {
        logger.warn(
          { model: name, msg: String(err.message || '').slice(0, 200) },
          '[Gemini] quota/overload — trying next model'
        );
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  const e = new Error(`All Gemini models exhausted (${models.join(', ')})`);
  e.cause = lastError;
  throw e;
}

module.exports = { generateContent, _internal: { isFallbackEligibleError, parseModels, DEFAULT_MODELS } };
