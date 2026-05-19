// Express 애플리케이션 정의 — 미들웨어/라우트/에러핸들러만.
//
// 부팅 부작용(mongoose.connect, app.listen, cron 등록, 보안 자가진단)은 server.js로 분리됨.
// 그 결과 app.js는 require해도 포트 점유나 외부 연결이 발생하지 않아 supertest로
// 직접 invoke 가능.
//
// Sentry 자동 계측은 server.js에서 require('./instrument')로 사전 로드된다.
// 테스트 환경(jest)에서는 SENTRY_DSN이 없으면 init이 no-op이라 import 안전.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const Sentry = require('@sentry/node');
const User = require('./models/User');
const logger = require('./src/lib/logger');
const { authLimiter, submissionLimiter, generalLimiter } = require('./middleware/rateLimits');
const errorHandler = require('./middleware/errorHandler');
const { triggerScraper, getScraperStatus } = require('./src/services/scraperRunner');

const app = express();

// expo-server-sdk v6는 ESM-only — 사용 시점에 dynamic import해서 캐싱.
let _expoSdkPromise = null;
function loadExpoSdk() {
  if (!_expoSdkPromise) _expoSdkPromise = import('expo-server-sdk');
  return _expoSdkPromise;
}

// ===== 요청 로깅 (pino-http) =====
// helmet 전에 두면 차단된 요청 로그가 안 남음 → helmet 다음, CORS/rate-limit 전이 안전.
// /health는 UptimeRobot이 5분마다 ping해서 노이즈 큼 → autoLogging.ignore로 제외.
// 4xx→warn, 5xx→error 자동 분류.

// ===== 보안 미들웨어 =====
// helmet — 표준 보안 헤더. API-only라 CSP는 비활성
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// CORS — 화이트리스트 (CORS_ALLOWED_ORIGINS env, 쉼표 구분)
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // server-to-server / curl / 모바일 native
      if (CORS_ALLOWED_ORIGINS.length === 0) return cb(null, true); // dev fallback
      if (CORS_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      logger.warn({ origin }, '[CORS] blocked origin');
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check — Render healthCheckPath / UptimeRobot 핑 대상. rate-limit 전에 둬서
// 부하 상황에서도 200 유지. DB 상태도 함께 노출(undefined=초기, 1=connected).
// mongoose는 require 시점에 가능 — connect는 server.js에서.
const mongoose = require('mongoose');
app.get('/health', (req, res) => {
  const mongoState = mongoose.connection?.readyState;
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    mongo: mongoState === 1 ? 'connected' : `state:${mongoState}`,
    ts: new Date().toISOString(),
  });
});

// Rate limit — 라우트 그룹별. scraper는 자체 토큰+쿨다운으로 제외
app.use('/api/auth', authLimiter);
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/scraper/') || req.path.startsWith('/auth/')) return next();
  return generalLimiter(req, res, next);
});

// Passport
const passport = require('passport');
require('./config/passport-setup');
app.use(passport.initialize());

// 인증 미들웨어 require — 일부 엔드포인트가 라우터 모듈 등록 전에 직접 부착되므로 여기서.
const _authMiddlewareEarly = require('./middleware/authMiddleware');
const _adminMiddlewareEarly = require('./middleware/adminMiddleware');

// push token 등록 — body의 userId 신뢰 X. JWT의 req.user.id로만 본인 토큰 갱신.
app.post('/api/users/push-token', _authMiddlewareEarly, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.push_token = token;
    await user.save();
    res.json({ message: 'Push token registered successfully' });
  } catch (error) {
    logger.error({ err: error }, 'push token registration failed');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 테스트 푸시 — 운영에서는 비활성, dev에서도 admin 전용.
app.post('/api/notifications/test', _authMiddlewareEarly, _adminMiddlewareEarly, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not Found' });
  }
  try {
    const { Expo } = await loadExpoSdk();
    const expo = new Expo();
    const users = await User.find({ push_token: { $exists: true, $ne: null } });
    const pushTokens = users.map(user => user.push_token);
    if (pushTokens.length === 0) return res.status(404).json({ message: 'No registered push tokens found.' });
    const messages = [];
    for (const pushToken of pushTokens) {
      if (!Expo.isExpoPushToken(pushToken)) continue;
      messages.push({
        to: pushToken,
        sound: 'default',
        title: '테스트 알림',
        body: '푸시 알림 연동이 정상 동작합니다.',
        data: { screen: 'Home' },
      });
    }
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    res.json({ message: 'Test push notifications sent!', tickets });
  } catch (error) {
    logger.error({ err: error }, 'test push notification send failed');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// scraper HTTP endpoints — 공유 상태는 scraperRunner 모듈이 보유.
const SCRAPER_ADMIN_TOKEN = process.env.SCRAPER_ADMIN_TOKEN || '';

function requireAdminToken(req, res, next) {
  if (!SCRAPER_ADMIN_TOKEN) return next(); // 토큰 미설정 시 인증 우회 (개발 편의)
  const header = req.headers.authorization || '';
  const provided =
    header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-admin-token'];
  if (provided !== SCRAPER_ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/scraper/run', requireAdminToken, async (req, res) => {
  const r = await triggerScraper('http');
  if (r.started) return res.json({ message: 'Scraper execution started' });
  if (r.reason === 'already-running') {
    return res.status(409).json({ error: 'Scraper is already running' });
  }
  if (r.reason === 'cooldown') {
    res.set('Retry-After', String(r.retryAfterSec));
    return res.status(429).json({ error: 'Cooldown active', retryAfterSec: r.retryAfterSec });
  }
  return res.status(500).json({ error: 'Unknown error' });
});

app.get('/api/scraper/status', (req, res) => {
  res.json(getScraperStatus());
});

// --- API Routes ---
// Express 5 라우터에서 정적 path 매칭이 깨지는 케이스가 있어 신규 엔드포인트는 server에 직접 등록
const authMiddleware = require('./middleware/authMiddleware');
const adminMiddleware = require('./middleware/adminMiddleware');
const { deleteAccount } = require('./controllers/userController');
const {
  createSubmission,
  listMySubmissions,
  adminListSubmissions,
  adminApproveSubmission,
  adminRejectSubmission,
} = require('./controllers/submissionController');
const {
  adminCreateAirdrop,
  adminUpdateAirdrop,
  adminDeleteAirdrop,
} = require('./controllers/adminAirdropController');
const {
  listDrafts,
  updateDraft,
  approveDraft,
  rejectDraft,
  deleteDraft,
  draftFromUrl,
  triggerCollect,
} = require('./controllers/adminDraftController');

// 사용자 계정 삭제
app.delete('/api/user/account', authMiddleware, deleteAccount);

// 사용자 제보 — POST에 더 엄격한 limit (스팸 방어)
app.post('/api/submissions', submissionLimiter, authMiddleware, createSubmission);
app.get('/api/submissions/mine', authMiddleware, listMySubmissions);

// 관리자 — 제보 검토
app.get('/api/admin/submissions', authMiddleware, adminMiddleware, adminListSubmissions);
app.post('/api/admin/submissions/:id/approve', authMiddleware, adminMiddleware, adminApproveSubmission);
app.post('/api/admin/submissions/:id/reject', authMiddleware, adminMiddleware, adminRejectSubmission);

// 관리자 — 에어드랍 직접 관리
app.post('/api/admin/airdrops', authMiddleware, adminMiddleware, adminCreateAirdrop);
app.put('/api/admin/airdrops/:id', authMiddleware, adminMiddleware, adminUpdateAirdrop);
app.delete('/api/admin/airdrops/:id', authMiddleware, adminMiddleware, adminDeleteAirdrop);

// 관리자 — Draft 큐레이션 (커뮤니티 수집 → AI 추출 → 검토 → 승격)
app.get('/api/admin/drafts', authMiddleware, adminMiddleware, listDrafts);
app.patch('/api/admin/drafts/:id', authMiddleware, adminMiddleware, updateDraft);
app.post('/api/admin/drafts/:id/approve', authMiddleware, adminMiddleware, approveDraft);
app.post('/api/admin/drafts/:id/reject', authMiddleware, adminMiddleware, rejectDraft);
app.delete('/api/admin/drafts/:id', authMiddleware, adminMiddleware, deleteDraft);
app.post('/api/admin/drafts/from-url', authMiddleware, adminMiddleware, draftFromUrl);
app.post('/api/admin/drafts/collect', authMiddleware, adminMiddleware, triggerCollect);

app.use('/api/airdrops', require('./routes/airdrops'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/market', require('./routes/market'));

// errorHandler 통합 검증용 라우트 — dev에서만 노출
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/_debug/throw', () => {
    const err = new Error('Sensitive internal: DB at mongodb://secret-host:27017');
    err.status = 500;
    throw err;
  });
}

// Sentry Express 에러 핸들러 — 모든 라우트 등록 직후, 자체 errorHandler 직전에 부착.
// 4xx는 자동으로 무시되고 5xx만 캡쳐된다. SENTRY_DSN 미설정 시 no-op.
Sentry.setupExpressErrorHandler(app);

// 글로벌 에러 핸들러 — 모든 라우트 등록 후 마지막에 부착
app.use(errorHandler);

module.exports = app;
