// 에어드랍 retention 정책 (cron으로 주기 실행).
//
// 만료된(end_date < now) Airdrop을 삭제한다. 뉴스 기능이 제거되어 더 이상
// News로 강등하지 않으며, 만료 항목은 그대로 정리한다.
// (getAirdrops 쿼리도 end_date >= now 만 노출하므로 만료 항목은 이미 숨겨진 상태)

const Airdrop = require('../../models/Airdrop');
const logger = require('../lib/logger');

async function purgeExpiredAirdrops({ now = new Date() } = {}) {
  const result = await Airdrop.deleteMany({
    end_date: { $exists: true, $ne: null, $lt: now },
  });

  if (result.deletedCount > 0) {
    logger.info({ deleted: result.deletedCount }, '[Retention] purged expired airdrops');
  }
  return { deleted: result.deletedCount || 0, ranAt: new Date().toISOString() };
}

module.exports = { purgeExpiredAirdrops };
