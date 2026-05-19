// 스크래퍼 트리거 + 공유 상태 모듈.
// HTTP 핸들러(app.js의 /api/scraper/*)와 cron(server.js)이 같은 락/쿨다운을 공유해야 하므로
// 모듈 레벨 싱글톤으로 분리한다.
//
// 동시 실행 방지 + 쿨다운으로 외부 AI API quota를 보호하는 게 목적.

const { runScraper } = require('./scraper');
const logger = require('../lib/logger');

// 30분 쿨다운 — 매시 cron(60분 간격)과 양립, HTTP 연타 차단
const SCRAPER_COOLDOWN_MS = 30 * 60 * 1000;

let scraperRunning = false;
let scraperLastRunAt = 0;
let scraperLastStats = null; // 마지막 runScraper() 반환값 또는 에러 요약

// reason: 'http' | 'cron' — 로그용 라벨.
// 반환: { started: boolean, reason?: 'already-running' | 'cooldown', retryAfterSec?: number }
async function triggerScraper(reason) {
  if (scraperRunning) return { started: false, reason: 'already-running' };
  const elapsed = Date.now() - scraperLastRunAt;
  if (scraperLastRunAt !== 0 && elapsed < SCRAPER_COOLDOWN_MS) {
    return {
      started: false,
      reason: 'cooldown',
      retryAfterSec: Math.ceil((SCRAPER_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  scraperRunning = true;
  scraperLastRunAt = Date.now();
  logger.info({ reason }, '[Scraper] triggered');
  runScraper()
    .then((stats) => {
      scraperLastStats = stats;
    })
    .catch((error) => {
      logger.error({ err: error }, '[Scraper] run failed');
      scraperLastStats = {
        error: String(error.message || error),
        failedAt: new Date().toISOString(),
      };
    })
    .finally(() => {
      scraperRunning = false;
    });
  return { started: true };
}

function getScraperStatus() {
  const elapsed = Date.now() - scraperLastRunAt;
  const cooldownRemainingSec =
    scraperLastRunAt === 0 ? 0 : Math.max(0, Math.ceil((SCRAPER_COOLDOWN_MS - elapsed) / 1000));
  return {
    running: scraperRunning,
    lastRunAt: scraperLastRunAt ? new Date(scraperLastRunAt).toISOString() : null,
    cooldownRemainingSec,
    lastStats: scraperLastStats,
  };
}

module.exports = {
  SCRAPER_COOLDOWN_MS,
  triggerScraper,
  getScraperStatus,
};
