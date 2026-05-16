// 기존 News 컬렉션의 영어 항목을 AI 배치로 한국어 번역.
// - title 또는 description이 한글 없으면 번역 대상으로 간주
// - 배치 10개씩, 호출 사이 5초 sleep
// - 실패한 배치는 원문 유지

require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const News = require('../../models/News');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

const BATCH_SIZE = 10;

// 한글이 1글자라도 있으면 이미 번역된 것으로 간주
const HANGUL = /[가-힣]/;

function buildTranslatePrompt(batch) {
  const inputs = batch.map((n, idx) => ({
    idx,
    title: n.title,
    content: (n.description || '').slice(0, 800),
  }));
  return `
You are a Korean translator for cryptocurrency news.
Translate the title and content into natural Korean. Keep tickers/project names in original form (BTC, ETH, Ripple 등).

Input news (JSON):
${JSON.stringify(inputs, null, 2)}

Respond ONLY with a JSON object with this EXACT structure (no markdown):
{
  "results": [
    {
      "idx": <integer>,
      "title": "<한국어 제목>",
      "description": "<한국어 3문장 요약. 핵심 사실 위주.>"
    }
  ]
}

Return EXACTLY ${batch.length} results.
`.trim();
}

function parseResponse(rawText) {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error('missing results array');
  }
  const byIdx = new Map();
  for (const r of parsed.results) {
    if (typeof r.idx === 'number') byIdx.set(r.idx, r);
  }
  return byIdx;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const targets = await News.find({
    $or: [{ title: { $not: HANGUL } }, { description: { $not: HANGUL } }],
  }).lean();

  console.log(`번역 대상: ${targets.length}개`);
  if (targets.length === 0) {
    await mongoose.disconnect();
    return;
  }

  let translated = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`배치 ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}~${i + batch.length})...`);

    try {
      const result = await model.generateContent(buildTranslatePrompt(batch), {
        responseMimeType: 'application/json',
      });
      const response = await result.response;
      const byIdx = parseResponse(response.text());

      for (let j = 0; j < batch.length; j++) {
        const r = byIdx.get(j);
        if (!r) {
          failed++;
          continue;
        }
        await News.updateOne(
          { _id: batch[j]._id },
          { $set: { title: r.title || batch[j].title, description: r.description || batch[j].description } }
        );
        translated++;
      }
    } catch (err) {
      console.warn('  배치 실패:', err.message || err);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < targets.length) await sleep(5000);
  }

  console.log(`\n번역 완료: ${translated}개 | 실패: ${failed}개`);
  await mongoose.disconnect();
})();
