// 휴리스틱으로 잘못 airdrop 분류된 항목들을 정리하는 일회성 스크립트
// 판단 기준: description이 placeholder("(휴리스틱 분석)" 포함) 또는 trust_score < 20인 airdrop
// 동작: 해당 airdrop 항목을 삭제하고 동일 unique_hash로 News 컬렉션에 재저장

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Airdrop = require('../models/Airdrop');
const News = require('../models/News');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  // 휴리스틱 placeholder 흔적이 있거나 trust_score가 매우 낮은 airdrop = 잘못 분류
  const suspects = await Airdrop.find({
    $or: [
      { description: /휴리스틱 분석/ },
      { trust_score: { $lt: 20 } },
    ],
  }).lean();

  console.log(`잘못 분류된 것으로 판단되는 airdrop 항목: ${suspects.length}건`);
  for (const s of suspects) {
    console.log(`  - ${s.title} (score=${s.trust_score})`);
  }

  if (suspects.length === 0) {
    console.log('정리할 항목 없음.');
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
          s.description && !/휴리스틱 분석/.test(s.description)
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
