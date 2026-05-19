// 관리자 / 계정 관리 라우트 DB 통합 테스트.

jest.mock('../src/services/scraper', () => ({
  runScraper: jest.fn().mockResolvedValue({ stubbed: true }),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../app');
const User = require('../models/User');
const Submission = require('../models/Submission');
const Airdrop = require('../models/Airdrop');
const {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} = require('./helpers/db');

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

// 어드민 권한이 필요한 라우트 테스트 — register 라우트는 isAdmin=false만 만들어주므로
// 모델 직접 create + jwt.sign으로 토큰 발급. controller가 보는 payload 모양(req.user.id)과
// 동일하게 작성.
async function createUserWithToken({ isAdmin = false, email, username, password = 'Pass1234' } = {}) {
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: username || `u${Math.random().toString(36).slice(2, 8)}`,
    email: email || `${Math.random().toString(36).slice(2, 10)}@e.com`,
    password: hash,
    isAdmin,
  });
  const token = jwt.sign(
    { user: { id: user.id } },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
  return { user, token, plainPassword: password };
}

describe('DELETE /api/user/account', () => {
  test('deletes account; subsequent login fails', async () => {
    const { user, token, plainPassword } = await createUserWithToken({
      email: 'delete-me@example.com',
    });

    const res = await request(app)
      .delete('/api/user/account')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });

    // DB에서 사라졌는지
    const exists = await User.findById(user._id);
    expect(exists).toBeNull();

    // 같은 자격으로 로그인 시도 — invalid_credentials
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'delete-me@example.com', password: plainPassword });
    expect(login.status).toBe(400);
    expect(login.body.error).toBe('invalid_credentials');
  });

  test('rejects without auth → 401', async () => {
    const res = await request(app).delete('/api/user/account');
    expect(res.status).toBe(401);
  });
});

describe('Admin gate on /api/admin/submissions', () => {
  test('non-admin user → 403', async () => {
    const { token } = await createUserWithToken({ isAdmin: false });
    const res = await request(app)
      .get('/api/admin/submissions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ msg: 'Admin only' });
  });

  test('admin user → 200 with submission list', async () => {
    const { token: adminToken } = await createUserWithToken({
      isAdmin: true,
      email: 'admin@example.com',
      username: 'adminuser',
    });
    const { token: userToken } = await createUserWithToken({
      email: 'submitter@example.com',
      username: 'submitter',
    });

    // submitter가 제보 2건
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'S1', description: 'd', official_link: 'https://s1' });
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'S2', description: 'd', official_link: 'https://s2' });

    const res = await request(app)
      .get('/api/admin/submissions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // populated submittedBy(username/email)
    for (const s of res.body.data) {
      expect(s.submittedBy).toMatchObject({
        username: 'submitter',
        email: 'submitter@example.com',
      });
    }
  });

  test('admin list filters by status=pending', async () => {
    const { token: adminToken } = await createUserWithToken({ isAdmin: true });
    const { token: userToken, user } = await createUserWithToken({
      username: 'subby',
      email: 'subby@e.com',
    });
    // 직접 두 건 만들고 한 건은 approved로
    await Submission.create({
      submittedBy: user._id,
      title: 'pending1',
      description: 'd',
      official_link: 'https://p',
    });
    await Submission.create({
      submittedBy: user._id,
      title: 'approved1',
      description: 'd',
      official_link: 'https://a',
      status: 'approved',
    });

    const res = await request(app)
      .get('/api/admin/submissions?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('pending1');
  });
});

describe('POST /api/admin/submissions/:id/approve', () => {
  test('admin approve creates Airdrop and marks submission approved', async () => {
    const { token: adminToken, user: adminUser } = await createUserWithToken({
      isAdmin: true,
    });
    const { token: userToken } = await createUserWithToken({
      username: 'subby2',
      email: 'subby2@e.com',
    });

    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'To approve',
        description: 'good one',
        official_link: 'https://approve-me',
        category: 'NFT',
        chain: 'Polygon',
        end_date: '2026-12-31',
      });
    expect(createRes.status).toBe(201);
    const subId = createRes.body.submission._id;

    const res = await request(app)
      .post(`/api/admin/submissions/${subId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'looks good' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.submission.status).toBe('approved');
    expect(res.body.submission.reviewedBy.toString()).toBe(adminUser.id);
    expect(res.body.submission.reviewNote).toBe('looks good');
    expect(res.body.airdrop).toMatchObject({
      title: 'To approve',
      official_link: 'https://approve-me',
      source: ['curated'],
      trend_score: 75,
      is_confirmed: true,
      is_airdrop: true,
    });

    // Airdrop이 실제 컬렉션에 들어갔는지
    const airdrops = await Airdrop.find({});
    expect(airdrops).toHaveLength(1);
    expect(airdrops[0].title).toBe('To approve');
  });

  test('approving already-approved submission → 400', async () => {
    const { token: adminToken } = await createUserWithToken({ isAdmin: true });
    const { user } = await createUserWithToken({
      username: 'subby3',
      email: 'subby3@e.com',
    });
    const sub = await Submission.create({
      submittedBy: user._id,
      title: 'Already',
      description: 'd',
      official_link: 'https://x',
      status: 'approved',
    });
    const res = await request(app)
      .post(`/api/admin/submissions/${sub._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/이미 승인/);
  });
});
