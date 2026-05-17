// 에어드랍 retention 정책 (cron으로 주기 실행).
//
// 만료된(end_date < now) Airdrop을 News로 강등한다.
// 강등 = News에 insert + Airdrop에서 delete (순차 처리, 실패 항목은 건너뜀).
//
// _id는 보존한다 — 강등 전 발송된 푸시 알림의 deep link(`airdropId`)가
// `GET /api/airdrops/:id` → `airdropController.getAirdropById`의 News fallback으로
// 강등된 항목을 정상 반환하도록 한다. created_at도 보존(원본 게시 시점 유지) —
// News 3일 보관 정책은 created_at 기준이므로, 강등 시점에 새로 발급하면 만료된
// 에어드랍이 News로 옮겨와 3일 더 머무는 셈이 되어 의도와 어긋난다.

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');

async function demoteExpiredAirdrops({ now = new Date() } = {}) {
  const expired = await Airdrop.find({
    end_date: { $exists: true, $ne: null, $lt: now },
  }).lean();

  let demoted = 0;
  let skipped = 0;
  let errors = 0;

  for (const a of expired) {
    try {
      const existingNews = await News.findOne({ unique_hash: a.unique_hash });
      if (!existingNews) {
        await News.create({
          _id: a._id,                  // 푸시 deep link 호환
          created_at: a.created_at,    // 원본 게시 시점 유지 (3일 보관 정책)
          title: a.title,
          description: a.description,
          official_link: a.official_link,
          source: Array.isArray(a.source) && a.source.length > 0 ? a.source : ['알 수 없음'],
          unique_hash: a.unique_hash,
        });
        demoted++;
      } else {
        skipped++; // News에 이미 같은 unique_hash가 있음
      }
      await Airdrop.deleteOne({ _id: a._id });
    } catch (err) {
      errors++;
      console.error(`[Retention] demote failed for ${a._id} (${a.title}):`, err.message || err);
    }
  }

  if (expired.length > 0 || demoted > 0) {
    console.log(
      `[Retention] demoted ${demoted} expired airdrops (skipped=${skipped}, errors=${errors})`
    );
  }
  return { found: expired.length, demoted, skipped, errors, ranAt: new Date().toISOString() };
}

module.exports = { demoteExpiredAirdrops };
