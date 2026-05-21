// trust_score → trend_score 리네임 마이그레이션.
//
// 커밋 f689001에서 필드명을 trust_score → trend_score로 바꿨으나 기존 DB 문서는
// 마이그레이션되지 않았다. API 필터(airdropController.getAirdrops)가 trend_score >= 20을
// 요구하므로, 옛 필드명만 가진 문서는 점수가 undefined로 읽혀 앱에서 전부 사라진다.
//
// 이 스크립트는 trust_score는 있고 trend_score는 없는 문서만 골라 필드명을 바꾼다.
// (양쪽 다 있으면 건드리지 않는다 — 새 코드가 쓴 trend_score를 보존)
//
// 사용법:
//   node scripts/migrations/rename-trust-score-to-trend-score.js           # dry-run (기본)
//   node scripts/migrations/rename-trust-score-to-trend-score.js --apply    # 실제 적용

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');
  console.log(`Mode: ${APPLY ? 'APPLY (실제 적용)' : 'DRY-RUN (조회만)'}`);

  const col = mongoose.connection.collection('airdrops');
  const filter = { trust_score: { $exists: true }, trend_score: { $exists: false } };
  const count = await col.countDocuments(filter);
  console.log(`\n대상 문서 (trust_score만 있음): ${count}건`);

  if (!APPLY) {
    console.log('\n--apply 플래그가 없어 실제 변경은 수행하지 않았습니다.');
    await mongoose.disconnect();
    return;
  }

  const r = await col.updateMany(filter, { $rename: { trust_score: 'trend_score' } });
  console.log(`\n이름 변경 완료: ${r.modifiedCount}건`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
