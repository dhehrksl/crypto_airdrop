// demoteExpiredAirdrops() 검증 (수동 실행).
//
// 임시 Airdrop 1건 생성 → end_date를 과거로 설정 → 함수 호출
//   → Airdrop에서 사라지고 News에 같은 _id로 생성됐는지 확인 → 정리.
//
// 실행: node scripts/dev/verify_retention.js
// 이 스크립트는 자기가 만든 테스트 데이터만 만지고 모두 정리한다.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');
const { demoteExpiredAirdrops } = require('../../src/services/retention');

let passed = 0;
let failed = 0;
function expect(cond, name, detail) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name} — ${detail || ''}`); failed++; }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7일 전
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tag = 'retention-verify:' + Date.now();

  // (1) 만료된 Airdrop 1건
  const expired = await Airdrop.create({
    title: 'retention test (expired)',
    description: 'should demote',
    official_link: 'https://example.com/retention-expired',
    end_date: past,
    trust_score: 50,
    source: ['verify'],
    unique_hash: tag + ':expired',
  });

  // (2) 만료되지 않은 Airdrop 1건 (대조군)
  const active = await Airdrop.create({
    title: 'retention test (active)',
    description: 'should remain',
    official_link: 'https://example.com/retention-active',
    end_date: future,
    trust_score: 50,
    source: ['verify'],
    unique_hash: tag + ':active',
  });

  // (3) end_date 없는 Airdrop 1건 (대조군)
  const noDate = await Airdrop.create({
    title: 'retention test (no end_date)',
    description: 'should remain (cannot judge)',
    official_link: 'https://example.com/retention-nodate',
    trust_score: 50,
    source: ['verify'],
    unique_hash: tag + ':nodate',
  });

  console.log('\ndemoteExpiredAirdrops()');
  const stats = await demoteExpiredAirdrops();
  expect(stats.demoted >= 1, '최소 1건 강등됨');

  // expired가 Airdrop에서 사라졌는지
  const expiredAfter = await Airdrop.findById(expired._id);
  expect(expiredAfter === null, '만료된 Airdrop 삭제됨');

  // News에 같은 _id로 존재하는지 (deep link 호환)
  const newsCopy = await News.findById(expired._id);
  expect(newsCopy !== null, '강등된 항목이 News에 같은 _id로 존재');
  if (newsCopy) {
    expect(newsCopy.title === expired.title, 'title 보존');
    expect(newsCopy.unique_hash === expired.unique_hash, 'unique_hash 보존');
  }

  // active는 그대로 있어야 함
  const activeAfter = await Airdrop.findById(active._id);
  expect(activeAfter !== null, '활성 Airdrop은 유지');

  // end_date 없는 항목도 그대로
  const noDateAfter = await Airdrop.findById(noDate._id);
  expect(noDateAfter !== null, 'end_date 없는 항목은 유지');

  // 정리
  await Airdrop.deleteMany({ unique_hash: { $regex: '^' + tag } });
  await News.deleteMany({ unique_hash: { $regex: '^' + tag } });

  await mongoose.disconnect();
  console.log(`\n결과: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
