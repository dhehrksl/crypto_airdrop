// cooldown 우회 단독 수집 — runCollection의 15분 cooldown을 무시하고 즉시 실행.
// 일회성 검증 + 수동 트리거용. 평소엔 collect.js 또는 cron 사용.
//
// 사용법: node scripts/draft/collect-force.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const AirdropDraft = require('../../models/AirdropDraft');
const { fetchTelegramAirdrops } = require('../../src/services/telegramSource');
const { extractAndSaveBatch } = require('../../src/services/draftExtractor');

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  console.log('Fetching Telegram channels...');
  const items = await fetchTelegramAirdrops();
  console.log(`수집된 메시지: ${items.length}건`);

  if (items.length === 0) {
    console.log('수집된 게시글이 없어 종료합니다.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 중복 제거 — 이미 처리된 unique_hash 제외
  const seen = await AirdropDraft.find(
    { unique_hash: { $in: items.map((i) => i.id) } },
    { unique_hash: 1 }
  ).lean();
  const seenSet = new Set(seen.map((s) => s.unique_hash));
  const fresh = items.filter((i) => !seenSet.has(i.id));
  console.log(`신규 후보: ${fresh.length}건 (중복 제외)`);

  if (fresh.length === 0) {
    console.log('처리할 신규 게시글이 없습니다.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('AI 추출 시작...');
  const stats = await extractAndSaveBatch(fresh);
  console.log('=== 결과 ===');
  console.log(JSON.stringify(stats, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
