require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Expo } = require('expo-server-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Airdrop = require('./models/Airdrop');
const News = require('./models/News');
const User = require('./models/User');
const { runScraper } = require('./src/services/scraper');

const app = express();
const expo = new Expo();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long';

app.use(cors());
app.use(express.json());

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
const SCRAPER_COOLDOWN_MS = 60 * 1000; // 1분 — 연타 방어 + RSS/quota 보호 최소선
const SCRAPER_ADMIN_TOKEN = process.env.SCRAPER_ADMIN_TOKEN || '';
let scraperRunning = false;
let scraperLastRunAt = 0;
let scraperLastStats = null; // 마지막 runScraper() 반환값

if (!SCRAPER_ADMIN_TOKEN) {
  console.warn(
    '[보안 경고] SCRAPER_ADMIN_TOKEN 환경변수가 설정되지 않았습니다. /api/scraper/run 인증이 비활성화됩니다 (개발용).'
  );
}

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

// 사용자 제보
app.post('/api/submissions', authMiddleware, createSubmission);
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


const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));



app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
