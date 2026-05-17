// 기존 DB의 만료된(end_date < now) Airdrop을 일괄 News로 강등한다.
// 이후엔 server.js의 retention cron이 매일 처리한다.
//
// 사용법:
//   node scripts/migrations/demote-expired-airdrops.js              # dry-run (기본)
//   node scripts/migrations/demote-expired-airdrops.js --apply      # 실제 강등 적용

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Airdrop = require('../../models/Airdrop');
const { demoteExpiredAirdrops } = require('../../src/services/retention');

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  console.log(`Mode: ${APPLY ? 'APPLY (실제 강등)' : 'DRY-RUN (조회만)'}`);

  const now = new Date();
  const expired = await Airdrop.find({
    end_date: { $exists: true, $ne: null, $lt: now },
  }).lean();

  console.log(`\n만료된 Airdrop: ${expired.length}건`);
  expired.slice(0, 10).forEach((d, i) => {
    console.log(`  #${i + 1}  title="${(d.title || '').slice(0, 60)}"`);
    console.log(`        end_date=${new Date(d.end_date).toISOString()}`);
    console.log(`        official_link=${d.official_link}`);
  });
  if (expired.length > 10) console.log(`  ... ${expired.length - 10}건 더`);

  if (!APPLY) {
    console.log('\n--apply 플래그가 없어 실제 강등은 수행하지 않았습니다.');
    await mongoose.disconnect();
    return;
  }

  const stats = await demoteExpiredAirdrops({ now });
  console.log('\n강등 결과:', stats);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
