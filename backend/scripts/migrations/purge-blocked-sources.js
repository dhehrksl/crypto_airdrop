// 차단된 출처(blockedSources)에서 적재된 Airdrop/News 항목을 영구 삭제한다.
//
// 사용법:
//   node scripts/migrations/purge-blocked-sources.js              # dry-run (기본)
//   node scripts/migrations/purge-blocked-sources.js --apply      # 실제 삭제 적용
//
// dry-run 시: 매치된 건수 + 샘플 5건씩 (Airdrop/News) 출력.
// --apply 시: 실제 삭제 후 deletedCount 출력.
//
// **운영 적용 전 mongodump 백업을 권장한다.**

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');
const {
  BLOCKED_HOSTS,
  BLOCKED_SOURCE_NAMES,
} = require('../../src/config/blockedSources');

const APPLY = process.argv.includes('--apply');

function buildMatchQuery() {
  // official_link 호스트 매치를 위한 정규식 — 서브도메인까지 포함.
  // host = "airdrops.io" 이면 :// 또는 // 또는 .airdrops.io 형태 모두 매치.
  const hostPatterns = BLOCKED_HOSTS.map(
    (h) => new RegExp(`^https?://([^/]+\\.)?${h.replace(/\./g, '\\.')}(/|$)`, 'i')
  );
  return {
    $or: [
      { official_link: { $in: hostPatterns } },
      { source: { $in: BLOCKED_SOURCE_NAMES } },
    ],
  };
}

function summarize(label, docs) {
  console.log(`\n[${label}] ${docs.length}건 매치`);
  docs.slice(0, 5).forEach((d, i) => {
    const src = Array.isArray(d.source) ? d.source.join(',') : d.source;
    console.log(`  #${i + 1}  title="${d.title?.slice(0, 60)}"`);
    console.log(`        link=${d.official_link}`);
    console.log(`        source=${src}`);
  });
  if (docs.length > 5) console.log(`  ... ${docs.length - 5}건 더`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  console.log(`Mode: ${APPLY ? 'APPLY (실제 삭제)' : 'DRY-RUN (조회만)'}`);
  console.log(`Blocked hosts:        ${BLOCKED_HOSTS.join(', ')}`);
  console.log(`Blocked sourceNames:  ${BLOCKED_SOURCE_NAMES.join(', ')}`);

  const query = buildMatchQuery();
  const airdropMatches = await Airdrop.find(query).lean();
  const newsMatches = await News.find(query).lean();

  summarize('Airdrop', airdropMatches);
  summarize('News', newsMatches);

  if (!APPLY) {
    console.log('\n--apply 플래그가 없어 실제 삭제는 수행하지 않았습니다.');
    await mongoose.disconnect();
    return;
  }

  // 실제 삭제는 _id 기반 (안전)
  const airdropIds = airdropMatches.map((d) => d._id);
  const newsIds = newsMatches.map((d) => d._id);

  const airdropResult = airdropIds.length
    ? await Airdrop.deleteMany({ _id: { $in: airdropIds } })
    : { deletedCount: 0 };
  const newsResult = newsIds.length
    ? await News.deleteMany({ _id: { $in: newsIds } })
    : { deletedCount: 0 };

  console.log(`\n삭제 완료: Airdrop=${airdropResult.deletedCount}, News=${newsResult.deletedCount}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
