// 잘못 분류된 airdrop 항목 정리.
// 판단 기준:
//   - description이 placeholder 패턴 ("휴리스틱 분석" / "출처(...)에서 확인하세요" / "원문에서 확인하세요" 등)
//   - trust_score < 20
// 동작: 해당 airdrop 항목을 삭제하고 동일 unique_hash로 News 컬렉션에 재저장.
//
// 사용법:
//   node scripts/cleanup_misclassified.js              # dry-run (기본)
//   node scripts/cleanup_misclassified.js --apply      # 실제 정리 적용

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Airdrop = require('../models/Airdrop');
const News = require('../models/News');

const APPLY = process.argv.includes('--apply');

// placeholder description 패턴 — 자체 콘텐츠 없이 외부 링크로만 유도하거나
// 휴리스틱 fallback 흔적이 남은 description.
const PLACEHOLDER_PATTERNS = [
  /휴리스틱\s*분석/,
  /상세\s*참여\s*방법은\s*출처/,
  /원문\s*링크에서\s*(상세\s*)?내용을?\s*확인/,
  /상세\s*내용은\s*출처/,
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  console.log(`Mode: ${APPLY ? 'APPLY (실제 정리)' : 'DRY-RUN (조회만)'}`);

  // placeholder description 흔적이 있거나 trust_score가 매우 낮은 airdrop = 잘못 분류
  const suspects = await Airdrop.find({
    $or: [
      ...PLACEHOLDER_PATTERNS.map((re) => ({ description: re })),
      { trust_score: { $lt: 20 } },
    ],
  }).lean();

  console.log(`\n잘못 분류된 것으로 판단되는 airdrop 항목: ${suspects.length}건`);
  for (const s of suspects.slice(0, 20)) {
    console.log(`  - ${s.title} (score=${s.trust_score})`);
    console.log(`        desc="${(s.description || '').slice(0, 80)}"`);
  }
  if (suspects.length > 20) console.log(`  ... ${suspects.length - 20}건 더`);

  if (suspects.length === 0) {
    console.log('\n정리할 항목 없음.');
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log('\n--apply 플래그가 없어 실제 정리는 수행하지 않았습니다.');
    await mongoose.disconnect();
    return;
  }

  let moved = 0;
  let removed = 0;
  for (const s of suspects) {
    // 동일 unique_hash로 News에 이미 있으면 News는 그대로 두고 Airdrop만 삭제
    const exists = await News.findOne({ unique_hash: s.unique_hash });
    if (!exists) {
      await News.create({
        title: s.title,
        description:
          s.description && !PLACEHOLDER_PATTERNS.some((re) => re.test(s.description))
            ? s.description
            : '원문 링크에서 상세 내용을 확인하세요.',
        official_link: s.official_link,
        source: Array.isArray(s.source) && s.source.length > 0 ? s.source : ['알 수 없음'],
        unique_hash: s.unique_hash,
      });
      moved++;
    }
    await Airdrop.deleteOne({ _id: s._id });
    removed++;
  }

  console.log(`\n완료: airdrop ${removed}건 삭제, News로 ${moved}건 이동`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
