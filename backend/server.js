// 백엔드 부팅 진입점 — bootstrapping에만 책임.
//
// 라우트/미들웨어/에러핸들러 정의는 app.js로 분리되어 있다 → require만 해도 안전(supertest 사용 가능).
// 본 파일은 다음 부작용을 모은다:
//   1) dotenv 로드
//   2) Sentry 자동 계측(다른 모듈 require 전에 instrument)
//   3) production fail-fast 보안 자가진단
//   4) MongoDB 연결
//   5) cron 등록(scraper / draft collect / retention)
//   6) HTTP listen

require('dotenv').config();
// Sentry 자동 계측은 instrument.js가 다른 모듈보다 먼저 로드되어야 동작한다
// (express/mongoose가 require되기 전에 OpenTelemetry 훅을 걸어야 함).
require('./instrument');

// ===== 보안 자가 진단 (부팅 시 1회) =====
function runSecuritySelfCheck() {
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').trim();
  const KNOWN_WEAK_JWT = [
    '',
    'change-me-to-a-long-random-string',
    'your-super-secret-key-that-is-long',
  ];
  const warnings = [];
  const fatals = [];

  if (isProd && !corsOrigins) {
    fatals.push('CORS_ALLOWED_ORIGINS가 비어 있습니다 (production 필수). 운영 도메인을 쉼표 구분으로 설정하세요.');
  } else if (!corsOrigins) {
    warnings.push('CORS_ALLOWED_ORIGINS 미설정 — 개발 모드 fallback으로 모든 origin 허용');
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (KNOWN_WEAK_JWT.includes(jwtSecret)) {
    if (isProd) {
      fatals.push('JWT_SECRET이 미설정 또는 약한 기본값입니다 (production 필수). crypto.randomBytes(48).toString("base64url")로 갱신.');
    } else {
      warnings.push('JWT_SECRET이 알려진 기본/약한 값입니다. crypto.randomBytes(48).toString("base64url")로 갱신 권장.');
    }
  } else if (jwtSecret.length < 32) {
    if (isProd) {
      fatals.push(`JWT_SECRET 길이가 ${jwtSecret.length}자로 짧습니다 (32자 이상 필요).`);
    } else {
      warnings.push(`JWT_SECRET 길이가 ${jwtSecret.length}자로 권장(32자 이상)에 못 미칩니다.`);
    }
  }

  if (!process.env.MONGODB_URI) {
    if (isProd) {
      fatals.push('MONGODB_URI 미설정 (production 필수). localhost fallback은 운영에 사용 불가.');
    } else {
      warnings.push('MONGODB_URI 미설정 — 개발 모드 fallback(localhost)으로 연결 시도.');
    }
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    warnings.push('GEMINI_API_KEY 미설정 — scraper/draftExtractor가 호출되면 실패합니다.');
  }

  if (!process.env.SCRAPER_ADMIN_TOKEN) {
    if (isProd) {
      fatals.push('SCRAPER_ADMIN_TOKEN 미설정 (production 필수). HTTP /api/scraper/run이 무인증 노출됩니다.');
    } else {
      warnings.push('SCRAPER_ADMIN_TOKEN 미설정 — /api/scraper/run 인증이 비활성화됩니다 (개발용).');
    }
  }

  if (isProd && process.env.GOOGLE_CLIENT_ID === 'dummy') {
    warnings.push('GOOGLE_CLIENT_ID=dummy in production — Google 로그인 작동 안 함.');
  }

  // 보안 자가진단은 logger require 전에 호출되므로 stderr 직접 출력.
  for (const w of warnings) process.stderr.write(`[보안 경고] ${w}\n`);
  for (const f of fatals) process.stderr.write(`[보안 치명적] ${f}\n`);
  if (fatals.length > 0) {
    process.stderr.write('production 환경에서 치명적 보안 설정이 누락되어 부팅을 중단합니다.\n');
    process.exit(1);
  }
}
runSecuritySelfCheck();

const mongoose = require('mongoose');
const cron = require('node-cron');
const app = require('./app');
const logger = require('./src/lib/logger');
const { triggerScraper } = require('./src/services/scraperRunner');
const { demoteExpiredAirdrops } = require('./src/services/retention');
const { runCollection } = require('./controllers/adminDraftController');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

mongoose
  .connect(MONGODB_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => logger.error({ err }, 'MongoDB connection failed'));

// ===== cron 등록 =====
// node-cron으로 1시간마다 자동 실행 (정각 0분)
const SCRAPER_CRON = process.env.SCRAPER_CRON || '0 * * * *';
const SCRAPER_CRON_ENABLED = process.env.SCRAPER_CRON_ENABLED !== 'false';
if (SCRAPER_CRON_ENABLED && cron.validate(SCRAPER_CRON)) {
  cron.schedule(SCRAPER_CRON, () => {
    triggerScraper('cron');
  });
  logger.info({ cron: SCRAPER_CRON }, '[Scraper] cron scheduled');
} else if (SCRAPER_CRON_ENABLED) {
  logger.warn({ cron: SCRAPER_CRON }, '[Scraper] invalid SCRAPER_CRON — cron disabled');
} else {
  logger.info('[Scraper] cron disabled by SCRAPER_CRON_ENABLED=false');
}

// Draft 자동 수집 — Reddit/Telegram 커뮤니티에서 7일치 → AI 구조 추출 → 관리자 대기 큐
// AI 호출 비용 절감 위해 6시간마다만 실행 (env로 비활성 가능)
const DRAFT_COLLECT_CRON = process.env.DRAFT_COLLECT_CRON || '0 */6 * * *';
const DRAFT_COLLECT_ENABLED = process.env.DRAFT_COLLECT_ENABLED !== 'false';
if (DRAFT_COLLECT_ENABLED && cron.validate(DRAFT_COLLECT_CRON)) {
  cron.schedule(DRAFT_COLLECT_CRON, () => {
    runCollection('cron').catch((err) =>
      logger.error({ err }, '[Draft Collect] cron run failed')
    );
  });
  logger.info({ cron: DRAFT_COLLECT_CRON }, '[Draft Collect] cron scheduled');
} else if (DRAFT_COLLECT_ENABLED) {
  logger.warn({ cron: DRAFT_COLLECT_CRON }, '[Draft Collect] invalid cron expression — disabled');
} else {
  logger.info('[Draft Collect] cron disabled by DRAFT_COLLECT_ENABLED=false');
}

// 만료된 에어드랍 자동 강등 (매일 1회)
const AIRDROP_RETENTION_CRON = process.env.AIRDROP_RETENTION_CRON || '0 3 * * *'; // 매일 03:00
const AIRDROP_RETENTION_ENABLED = process.env.AIRDROP_RETENTION_ENABLED !== 'false';
if (AIRDROP_RETENTION_ENABLED && cron.validate(AIRDROP_RETENTION_CRON)) {
  cron.schedule(
    AIRDROP_RETENTION_CRON,
    () => {
      demoteExpiredAirdrops().catch((err) =>
        logger.error({ err }, '[Retention] cron run failed')
      );
    },
    { timezone: 'Asia/Seoul' }
  );
  logger.info({ cron: AIRDROP_RETENTION_CRON }, '[Retention] cron scheduled (KST)');
} else if (AIRDROP_RETENTION_ENABLED) {
  logger.warn(
    { cron: AIRDROP_RETENTION_CRON },
    '[Retention] invalid AIRDROP_RETENTION_CRON — cron disabled'
  );
} else {
  logger.info('[Retention] cron disabled by AIRDROP_RETENTION_ENABLED=false');
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend server running');
});
