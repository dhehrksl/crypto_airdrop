// 로컬 미리보기 — MongoDB 없이 스크래퍼 결과를 HTML 파일로 저장한다.
//
// 흐름: RSS 수집 → 휴리스틱 평가 → AI 배치 분류(Gemini) → HTML 카드 출력.
// 저장된 결과는 백엔드 DB에 들어가지 않으며, scraper-preview.html을 브라우저로 열어 확인한다.
//
// 사용법:
//   cd backend
//   node scripts/scraper/preview.js
//   # → backend/scraper-preview.html 생성 후 브라우저로 자동 오픈 시도

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const fs = require('fs');
const { exec } = require('child_process');

const { isBlockedSource } = require('../../src/config/blockedSources');
const {
  fetchRealData,
  evaluateNews,
  buildBatchPrompt,
  parseBatchResponse,
  shouldDemoteAirdrop,
  AI_THRESHOLD,
  BATCH_SIZE,
} = require('../../src/services/scraper');
const geminiClient = require('../../src/services/geminiClient');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml({ generatedAt, stats, airdrops, dropped }) {
  const airdropCards = airdrops
    .sort((a, b) => (b.ai.trend_score || 0) - (a.ai.trend_score || 0))
    .map((row) => {
      const { item, evaluation, ai } = row;
      const trend = ai.trend_score || 0;
      const trendColor = trend >= 80 ? '#22c55e' : trend >= 50 ? '#eab308' : '#94a3b8';
      const endDate = ai.end_date
        ? new Date(ai.end_date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '미정';
      const scam = ai.is_scam ? '<span class="tag scam">⚠ 스캠 의심</span>' : '';
      const confirmed = ai.is_confirmed ? '<span class="tag confirmed">공식 확인</span>' : '';
      return `
        <article class="card">
          <header>
            <div class="trend" style="color:${trendColor};">${trend}</div>
            <div class="meta">
              <h2>${escapeHtml(ai.title || item.title)}</h2>
              <div class="src">${escapeHtml(item.sourceName)} · 휴리스틱 ${evaluation.score}점</div>
            </div>
          </header>
          <p class="desc">${escapeHtml(ai.description || '')}</p>
          <div class="row">
            <span class="label">마감</span>
            <span>${escapeHtml(endDate)}</span>
          </div>
          <div class="row">
            <span class="label">원문 제목</span>
            <span class="orig">${escapeHtml(item.title)}</span>
          </div>
          <div class="tags">
            ${confirmed}
            ${scam}
          </div>
          <a class="link" href="${escapeHtml(ai.official_link || item.link)}" target="_blank" rel="noopener">공식/원본 링크 →</a>
        </article>
      `;
    })
    .join('\n');

  const droppedRows = dropped
    .slice(0, 50)
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.item.sourceName)}</td>
          <td>${escapeHtml(row.item.title)}</td>
          <td>${escapeHtml(row.reason)}</td>
        </tr>
      `,
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>크립토 에어드랍 미리보기 (${escapeHtml(generatedAt)})</title>
<style>
  :root {
    --bg: #0b1020;
    --panel: #131a30;
    --panel-2: #1a2240;
    --text: #e6ecff;
    --muted: #8b95b7;
    --accent: #6366f1;
    --danger: #ef4444;
    --ok: #22c55e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 14px/1.5 -apple-system, "Segoe UI", "Noto Sans KR", sans-serif;
  }
  header.top {
    padding: 24px 32px;
    background: var(--panel);
    border-bottom: 1px solid #233055;
    position: sticky; top: 0; z-index: 10;
  }
  header.top h1 { margin: 0 0 6px; font-size: 18px; }
  header.top .stats { color: var(--muted); font-size: 13px; }
  header.top .stats b { color: var(--text); }
  main { padding: 24px 32px 80px; max-width: 1200px; margin: 0 auto; }
  h2.section { margin: 32px 0 12px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }
  .card {
    background: var(--panel);
    border: 1px solid #233055;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card header { display: flex; gap: 12px; align-items: flex-start; }
  .trend {
    font-size: 28px;
    font-weight: 700;
    min-width: 56px;
    text-align: center;
    padding: 4px 0;
    background: var(--panel-2);
    border-radius: 8px;
  }
  .meta h2 { margin: 0 0 4px; font-size: 15px; line-height: 1.35; }
  .src { color: var(--muted); font-size: 12px; }
  .desc { margin: 4px 0; color: #c8d0ee; }
  .row { display: flex; gap: 8px; font-size: 13px; }
  .label { color: var(--muted); min-width: 60px; }
  .orig { color: var(--muted); font-size: 12px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 2px 8px; border-radius: 999px; font-size: 11px; }
  .tag.scam { background: rgba(239, 68, 68, 0.18); color: var(--danger); }
  .tag.confirmed { background: rgba(34, 197, 94, 0.18); color: var(--ok); }
  .link {
    margin-top: auto;
    color: var(--accent);
    text-decoration: none;
    font-size: 13px;
    padding-top: 8px;
    border-top: 1px solid #233055;
  }
  .link:hover { text-decoration: underline; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--panel);
    border-radius: 12px;
    overflow: hidden;
  }
  th, td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid #233055;
    font-size: 12px;
  }
  th { background: var(--panel-2); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .empty { color: var(--muted); padding: 24px; text-align: center; background: var(--panel); border-radius: 12px; }
</style>
</head>
<body>
<header class="top">
  <h1>🪂 크립토 에어드랍 미리보기</h1>
  <div class="stats">
    수집 ${stats.items}건 · AI 호출 ${stats.aiCalls}회 · 에어드랍 저장 후보
    <b>${airdrops.length}</b>건 · 휴리스틱 탈락 ${stats.dropped}건 · 차단 ${stats.blocked}건 · 노이즈 ${stats.skipped}건
    · 생성 ${escapeHtml(generatedAt)}
  </div>
</header>
<main>
  <h2 class="section">✨ AI가 활성 에어드랍으로 판정한 항목 (trend score 내림차순)</h2>
  ${airdrops.length === 0
    ? '<div class="empty">AI가 "활성 에어드랍"으로 판정한 항목이 없습니다. RSS 피드 결과를 다시 확인해보세요.</div>'
    : `<div class="grid">${airdropCards}</div>`}

  <h2 class="section">🪣 휴리스틱/AI 단계에서 탈락한 항목 (상위 50건)</h2>
  ${dropped.length === 0
    ? '<div class="empty">탈락 항목이 없습니다.</div>'
    : `<table>
        <thead><tr><th>출처</th><th>제목</th><th>탈락 사유</th></tr></thead>
        <tbody>${droppedRows}</tbody>
      </table>`}
</main>
</body>
</html>`;
}

function openInBrowser(absPath) {
  const platform = process.platform;
  const cmd =
    platform === 'win32'
      ? `start "" "${absPath}"`
      : platform === 'darwin'
      ? `open "${absPath}"`
      : `xdg-open "${absPath}"`;
  exec(cmd, (err) => {
    if (err) console.warn('브라우저 자동 열기 실패 — 파일을 수동으로 열어주세요:', absPath);
  });
}

async function main() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('GEMINI_API_KEY가 비어있습니다. backend/.env에 키를 넣어주세요.');
    process.exit(1);
  }

  console.log('--- RSS 수집 시작 ---');
  const rawItems = await fetchRealData();
  console.log(`총 ${rawItems.length}건 수집`);

  const aiCandidates = [];
  const dropped = [];
  let blocked = 0;
  let skipped = 0;

  for (const item of rawItems) {
    const blockedCheck = isBlockedSource({ link: item.link, sourceName: item.sourceName });
    if (blockedCheck.blocked) {
      blocked++;
      dropped.push({ item, reason: `차단 출처 (${blockedCheck.reason})` });
      continue;
    }
    const evaluation = evaluateNews(item);
    if (evaluation.skip) {
      skipped++;
      dropped.push({ item, reason: `노이즈 (${evaluation.reason})` });
      continue;
    }
    if (evaluation.score < AI_THRESHOLD) {
      dropped.push({ item, reason: `휴리스틱 점수 부족 (${evaluation.score} < ${AI_THRESHOLD})` });
      continue;
    }
    aiCandidates.push({ item, evaluation });
  }

  console.log(`휴리스틱 통과: ${aiCandidates.length}건 → AI 분류 시작 (배치 ${BATCH_SIZE})`);
  const airdrops = [];
  let aiCalls = 0;

  for (let i = 0; i < aiCandidates.length; i += BATCH_SIZE) {
    const slice = aiCandidates.slice(i, i + BATCH_SIZE);
    const batch = slice.map((s) => s.item);
    let byIdx;
    try {
      aiCalls++;
      console.log(`  [batch ${aiCalls}] ${batch.length}건 → Gemini 호출`);
      const { result } = await geminiClient.generateContent(buildBatchPrompt(batch), {
        responseMimeType: 'application/json',
      });
      const response = await result.response;
      byIdx = parseBatchResponse(response.text(), batch.length);
      if (i + BATCH_SIZE < aiCandidates.length) await sleep(5000);
    } catch (err) {
      console.error('  [batch] Gemini 호출 실패:', err.message);
      for (const { item } of slice) {
        dropped.push({ item, reason: 'Gemini 배치 실패' });
      }
      continue;
    }

    for (let j = 0; j < slice.length; j++) {
      const { item, evaluation } = slice[j];
      const ai = byIdx.get(j);
      if (!ai) {
        dropped.push({ item, reason: 'AI 응답 누락' });
        continue;
      }
      if (ai.is_scam === true) {
        dropped.push({ item, reason: 'AI: 스캠 의심' });
        continue;
      }
      const check = shouldDemoteAirdrop(ai, item);
      if (check.demote) {
        dropped.push({ item, reason: `AI 사후검증 탈락 (${check.reason})` });
        continue;
      }
      if (!ai.is_airdrop) {
        dropped.push({ item, reason: 'AI: 에어드랍 아님' });
        continue;
      }
      airdrops.push({ item, evaluation, ai });
    }
  }

  const stats = {
    items: rawItems.length,
    aiCalls,
    dropped: dropped.length,
    blocked,
    skipped,
  };
  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const html = renderHtml({ generatedAt, stats, airdrops, dropped });

  const outPath = path.resolve(__dirname, '../../scraper-preview.html');
  fs.writeFileSync(outPath, html, 'utf8');

  console.log('--- 결과 ---');
  console.log(`에어드랍 후보: ${airdrops.length}건 / 탈락: ${dropped.length}건 / AI 호출: ${aiCalls}회`);
  console.log(`HTML 저장: ${outPath}`);
  openInBrowser(outPath);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
