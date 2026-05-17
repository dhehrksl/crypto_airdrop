require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { Expo } = require('expo-server-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Airdrop = require('./models/Airdrop');
const News = require('./models/News');
const User = require('./models/User');
const { runScraper } = require('./src/services/scraper');
const { authLimiter, submissionLimiter, generalLimiter } = require('./middleware/rateLimits');
const errorHandler = require('./middleware/errorHandler');

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

  if (KNOWN_WEAK_JWT.includes(process.env.JWT_SECRET || '')) {
    warnings.push('JWT_SECRET이 알려진 기본/약한 값입니다. crypto.randomBytes(48).toString("base64url")로 갱신 권장.');
  }

  if (!process.env.SCRAPER_ADMIN_TOKEN) {
    warnings.push('SCRAPER_ADMIN_TOKEN 미설정 — /api/scraper/run 인증이 비활성화됩니다 (개발용).');
  }

  if (isProd && process.env.GOOGLE_CLIENT_ID === 'dummy') {
    warnings.push('GOOGLE_CLIENT_ID=dummy in production — Google 로그인 작동 안 함.');
  }

  for (const w of warnings) console.warn('[보안 경고]', w);
  for (const f of fatals) console.error('[보안 치명적]', f);
  if (fatals.length > 0) {
    console.error('production 환경에서 치명적 보안 설정이 누락되어 부팅을 중단합니다.');
    process.exit(1);
  }
}
runSecuritySelfCheck();

const app = express();
const expo = new Expo();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';

// ===== 보안 미들웨어 =====
// helmet — 표준 보안 헤더. API-only라 CSP는 비활성
app.use(helmet({ contentSecurityPolicy: false }));

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
      console.warn(`[CORS] blocked origin: ${origin}`);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());

// Rate limit — 라우트 그룹별. scraper는 자체 토큰+쿨다운으로 제외
app.use('/api/auth', authLimiter);
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/scraper/') || req.path.startsWith('/auth/')) return next();
  return generalLimiter(req, res, next);
});

// Passport middleware
const passport = require('passport');
require('./config/passport-setup'); // This configures the strategy
app.use(passport.initialize());


// --- Other API Routes ---

app.post('/api/users/push-token', async (req, res) => {
  try {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token and userId are required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.push_token = token;
    await user.save();
    res.json({ message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Push token registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/notifications/test', async (req, res) => {
  try {
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
    console.error('Error sending test push notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// scraper는 외부 AI API quota를 소모하므로 동시 실행 락 + 쿨다운으로 보호한다
const SCRAPER_COOLDOWN_MS = 30 * 60 * 1000; // 30분 — 매시 cron(60분 간격)과 양립, HTTP 연타 차단
const SCRAPER_ADMIN_TOKEN = process.env.SCRAPER_ADMIN_TOKEN || '';
let scraperRunning = false;
let scraperLastRunAt = 0;
let scraperLastStats = null; // 마지막 runScraper() 반환값
// SCRAPER_ADMIN_TOKEN 미설정 경고는 runSecuritySelfCheck()로 통합됨

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

// scraper 실행 트리거 함수 (HTTP 핸들러와 cron에서 공유)
async function triggerScraper(reason) {
  if (scraperRunning) return { started: false, reason: 'already-running' };
  const elapsed = Date.now() - scraperLastRunAt;
  if (elapsed < SCRAPER_COOLDOWN_MS) {
    return {
      started: false,
      reason: 'cooldown',
      retryAfterSec: Math.ceil((SCRAPER_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  scraperRunning = true;
  scraperLastRunAt = Date.now();
  console.log(`[Scraper] triggered by ${reason}`);
  runScraper()
    .then((stats) => {
      scraperLastStats = stats;
    })
    .catch((error) => {
      console.error('Scraper run failed:', error);
      scraperLastStats = { error: String(error.message || error), failedAt: new Date().toISOString() };
    })
    .finally(() => {
      scraperRunning = false;
    });
  return { started: true };
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
  const elapsed = Date.now() - scraperLastRunAt;
  const cooldownRemainingSec =
    scraperLastRunAt === 0 ? 0 : Math.max(0, Math.ceil((SCRAPER_COOLDOWN_MS - elapsed) / 1000));
  res.json({
    running: scraperRunning,
    lastRunAt: scraperLastRunAt ? new Date(scraperLastRunAt).toISOString() : null,
    cooldownRemainingSec,
    lastStats: scraperLastStats,
  });
});

// node-cron으로 1시간마다 자동 실행 (정각 0분)
const cron = require('node-cron');
const SCRAPER_CRON = process.env.SCRAPER_CRON || '0 * * * *'; // 매시 정각
const SCRAPER_CRON_ENABLED = process.env.SCRAPER_CRON_ENABLED !== 'false';
if (SCRAPER_CRON_ENABLED && cron.validate(SCRAPER_CRON)) {
  cron.schedule(SCRAPER_CRON, () => {
    triggerScraper('cron');
  });
  console.log(`[Scraper] cron scheduled: "${SCRAPER_CRON}"`);
} else if (SCRAPER_CRON_ENABLED) {
  console.warn(`[Scraper] invalid SCRAPER_CRON: "${SCRAPER_CRON}" — cron disabled`);
} else {
  console.log('[Scraper] cron disabled by SCRAPER_CRON_ENABLED=false');
}

// 만료된 에어드랍 자동 강등 (매일 1회)
const { demoteExpiredAirdrops } = require('./src/services/retention');
const AIRDROP_RETENTION_CRON = process.env.AIRDROP_RETENTION_CRON || '0 3 * * *'; // 매일 03:00
const AIRDROP_RETENTION_ENABLED = process.env.AIRDROP_RETENTION_ENABLED !== 'false';
if (AIRDROP_RETENTION_ENABLED && cron.validate(AIRDROP_RETENTION_CRON)) {
  cron.schedule(
    AIRDROP_RETENTION_CRON,
    () => {
      demoteExpiredAirdrops().catch((err) =>
        console.error('[Retention] cron run failed:', err.message || err)
      );
    },
    { timezone: 'Asia/Seoul' }
  );
  console.log(`[Retention] cron scheduled: "${AIRDROP_RETENTION_CRON}" (KST)`);
} else if (AIRDROP_RETENTION_ENABLED) {
  console.warn(
    `[Retention] invalid AIRDROP_RETENTION_CRON: "${AIRDROP_RETENTION_CRON}" — cron disabled`
  );
} else {
  console.log('[Retention] cron disabled by AIRDROP_RETENTION_ENABLED=false');
}

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


const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// 글로벌 에러 핸들러 — 모든 라우트 등록 후 마지막에 부착
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
