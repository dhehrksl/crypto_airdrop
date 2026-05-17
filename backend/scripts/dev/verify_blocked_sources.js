// blocklist 가드 검증 (수동 실행).
//
// 다음을 확인한다:
//  1. isBlockedSource() 순수 로직 — host / sourceName / sources 배열 각각
//  2. Airdrop pre-save validator — .create() 차단
//  3. Airdrop pre-update validator — .findOneAndUpdate() 차단
//  4. News 모델 동일 검증
//
// 실행: node scripts/dev/verify_blocked_sources.js
// 이 스크립트는 DB에 어떤 데이터도 남기지 않는다 (성공 시 모든 시도가 거절됨).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const { isBlockedSource } = require('../../src/config/blockedSources');
const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');

let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}
function fail(name, detail) {
  console.error(`  ✗ ${name} — ${detail}`);
  failed++;
}

function expect(cond, name, detail) {
  if (cond) ok(name);
  else fail(name, detail || 'condition false');
}

async function run() {
  console.log('\n[1] isBlockedSource() 순수 로직');
  expect(isBlockedSource({ link: 'https://airdrops.io/x' }).blocked === true, 'host=airdrops.io 차단');
  expect(isBlockedSource({ link: 'https://www.airdrops.io/x' }).blocked === true, 'www.airdrops.io 차단');
  expect(isBlockedSource({ link: 'https://sub.airdrops.io/x' }).blocked === true, '서브도메인 차단');
  expect(isBlockedSource({ link: 'https://example.com/x' }).blocked === false, '무관 호스트 통과');
  expect(isBlockedSource({ sourceName: 'airdrops.io' }).blocked === true, 'sourceName 차단');
  expect(isBlockedSource({ sources: ['cointelegraph', 'airdrops.io'] }).blocked === true, 'sources 배열 차단');
  expect(isBlockedSource({}).blocked === false, '빈 입력 통과');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  console.log('\n[2] Airdrop pre-save validator');
  try {
    await Airdrop.create({
      title: 'test-blocked',
      description: 'should fail',
      official_link: 'https://airdrops.io/should-fail',
      trust_score: 50,
      source: ['airdrops.io'],
      unique_hash: 'verify:' + Date.now(),
    });
    fail('차단 호스트로 create 거절', 'create가 성공했음 — 가드 실패');
    // 안전망: 만에 하나 들어갔다면 삭제
    await Airdrop.deleteOne({ title: 'test-blocked' });
  } catch (err) {
    expect(err.name === 'ValidationError', '차단 호스트로 create 거절', `unexpected error: ${err.name}`);
  }

  console.log('\n[3] Airdrop pre-update validator');
  // 정상 항목 하나 만들어서, 그 항목을 차단 호스트로 update 시도
  const seed = await Airdrop.create({
    title: 'verify-seed',
    description: 'will-be-removed',
    official_link: 'https://example.com/seed',
    trust_score: 50,
    source: ['verify'],
    unique_hash: 'verify-seed:' + Date.now(),
  });
  try {
    await Airdrop.findOneAndUpdate(
      { _id: seed._id },
      { $set: { official_link: 'https://airdrops.io/should-fail' } },
      { runValidators: true }
    );
    fail('차단 호스트로 update 거절', 'update가 성공');
  } catch (err) {
    expect(err.name === 'ValidationError', '차단 호스트로 update 거절', `unexpected error: ${err.name}`);
  }
  await Airdrop.deleteOne({ _id: seed._id });

  console.log('\n[4] News pre-save validator');
  try {
    await News.create({
      title: 'test-blocked-news',
      description: 'should fail',
      official_link: 'https://airdrops.io/news',
      source: ['airdrops.io'],
      unique_hash: 'verify-news:' + Date.now(),
    });
    fail('News 차단 호스트로 create 거절', 'create 성공');
    await News.deleteOne({ title: 'test-blocked-news' });
  } catch (err) {
    expect(err.name === 'ValidationError', 'News 차단 호스트로 create 거절', `unexpected error: ${err.name}`);
  }

  await mongoose.disconnect();
  console.log(`\n결과: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
