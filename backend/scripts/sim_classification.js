// 실제 RSS를 가져와서 AI 호출 없이 분류 결과만 시뮬레이션
// 사용법: node scripts/sim_classification.js
// MongoDB, Gemini API 키 모두 불필요 — 네트워크만 있으면 됨

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'dummy-for-simulation';

const {
  fetchRealData,
  evaluateNews,
  SKIP_THRESHOLD,
  AI_THRESHOLD,
  BATCH_SIZE,
} = require('../src/services/scraper');

(async () => {
  console.log('RSS 소스에서 수집 중... (네트워크 상태에 따라 30~60초 소요)\n');
  const items = await fetchRealData();
  console.log(`수집된 raw items: ${items.length}개\n`);

  const buckets = { skipNeg: [], skipLow: [], heuristic: [], ai: [] };
  for (const item of items) {
    const ev = evaluateNews(item);
    if (ev.skip) buckets.skipNeg.push({ score: 0, title: item.title, source: item.sourceName });
    else if (ev.score < SKIP_THRESHOLD) buckets.skipLow.push({ score: ev.score, title: item.title, source: item.sourceName });
    else if (ev.score < AI_THRESHOLD) buckets.heuristic.push({ score: ev.score, title: item.title, source: item.sourceName });
    else buckets.ai.push({ score: ev.score, title: item.title, source: item.sourceName });
  }

  const saved = buckets.heuristic.length + buckets.ai.length;
  const aiCalls = Math.ceil(buckets.ai.length / BATCH_SIZE);

  console.log('=== 분류 결과 ===');
  console.log(`✗ 잡음 필터(negative pattern 매치):           ${String(buckets.skipNeg.length).padStart(3)}개`);
  console.log(`✗ 저점수 폐기 (score < ${SKIP_THRESHOLD}):              ${String(buckets.skipLow.length).padStart(3)}개`);
  console.log(`◇ 휴리스틱 저장 (${SKIP_THRESHOLD} ≤ score < ${AI_THRESHOLD}):    ${String(buckets.heuristic.length).padStart(3)}개`);
  console.log(`★ AI 분석 대상 (score ≥ ${AI_THRESHOLD}):         ${String(buckets.ai.length).padStart(3)}개`);
  console.log('─────────────────────────────────────────');
  console.log(`📦 DB에 새로 저장될 예상 항목:                ${String(saved).padStart(3)}개`);
  console.log(`🤖 Gemini API 호출 예상 (배치 ${BATCH_SIZE}):          ${String(aiCalls).padStart(3)}회`);
  console.log(`📊 일일 quota 250건 ÷ ${aiCalls || 1}회 ≈ 하루 ${aiCalls ? Math.floor(250 / aiCalls) : '∞'}번 스크래핑 가능`);

  if (buckets.ai.length > 0) {
    console.log('\n=== AI 분석 대상 (score 높은 순) ===');
    buckets.ai.sort((a, b) => b.score - a.score).forEach((x) => {
      console.log(`  [${String(x.score).padStart(3)}] ${x.title}  (${x.source})`);
    });
  }

  if (buckets.heuristic.length > 0) {
    console.log('\n=== 휴리스틱 저장 대상 (상위 5개) ===');
    buckets.heuristic.sort((a, b) => b.score - a.score).slice(0, 5).forEach((x) => {
      console.log(`  [${String(x.score).padStart(3)}] ${x.title}  (${x.source})`);
    });
  }
})().catch((e) => {
  console.error('시뮬레이션 오류:', e);
  process.exit(1);
});
