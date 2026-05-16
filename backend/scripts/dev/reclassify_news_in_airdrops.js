// 기존 RSS 기반 Airdrop 항목 중 명백히 뉴스인 것들을 News 컬렉션으로 이동.
// 사용자가 지적한 사례:
//   - 가격 변동/시장 영향 기사 (이더파이/웜홀/옵티미즘 가격 분석)
//   - 과거 사건 사후 분석 (에어드랍 분배 이후 결과)
//   - 단순 추측성 ("에어드랍이 다가오는가?")
//   - 역사적 랭킹 ("2023년 상위 13개 에어드랍")
//   - 에어드랍 가이드/교육 콘텐츠 (밈코인 열풍 등)
//
// airdrops.io 출처는 절대 건드리지 않음 — 그쪽은 카탈로그라 신뢰 가능.

require('dotenv').config();
const mongoose = require('mongoose');
const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');

// 제목에 이 패턴이 있으면 뉴스로 간주
const NEWS_INDICATORS = [
  /가격\s*상승/i,
  /가격\s*하락/i,
  /가격\s*급등/i,
  /가격\s*폭락/i,
  /가치\s*하락/i,
  /가치\s*급등/i,
  /시장\s*혼란/i,
  /시장에\s*쏟아/i,
  /이정표/i, // milestone — speculation
  /다가오고\s*있는가/i,
  /상위\s*\d+개/i, // ranking
  /\b\d+%\s*(?:하락|상승|폭락|급등)/i,
  /price\s+(?:drop|surge|stumble|plunge|rally|prediction|analysis)/i,
  /market\s+(?:turbulence|reaction|crash|drop|surge)/i,
  /sparks?/i,
  /milestone/i,
  /열풍/i,
  /밈코인/i,
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const candidates = await Airdrop.find({
    source: { $ne: 'airdrops.io' },
  }).lean();

  let moved = 0;
  let kept = 0;
  for (const a of candidates) {
    const hit = NEWS_INDICATORS.some((p) => p.test(a.title || ''));
    if (!hit) {
      kept++;
      continue;
    }
    try {
      await News.findOneAndUpdate(
        { unique_hash: { $eq: a.unique_hash } },
        {
          $set: {
            title: a.title,
            description: a.description || '원문 링크에서 상세 내용을 확인하세요.',
            official_link: a.official_link,
            source: a.source && a.source.length ? a.source : ['알 수 없음'],
            unique_hash: a.unique_hash,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      await Airdrop.deleteOne({ _id: a._id });
      moved++;
      console.log('이동:', a.title);
    } catch (err) {
      console.warn('이동 실패:', a.title, '|', err.message || err);
    }
  }
  console.log(`\n총: ${candidates.length}개 검사 | News로 이동: ${moved}개 | 유지: ${kept}개`);
  await mongoose.disconnect();
})();
