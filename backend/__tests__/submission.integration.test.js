// 사용자 제보 라우트 DB 통합 테스트.

jest.mock('../src/services/scraper', () => ({
  runScraper: jest.fn().mockResolvedValue({ stubbed: true }),
}));

const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Submission = require('../models/Submission');
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

// 도우미 — 가입 후 토큰을 반환. 실제 라우트를 거쳐 비밀번호 해싱/JWT 발급 흐름과 동일.
async function registerAndGetToken(overrides = {}) {
  const body = {
    username: 'submituser',
    email: 'submit@example.com',
    password: 'abcd1234',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 200) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

describe('POST /api/submissions', () => {
  test('authenticated user creates submission → 201 with persisted doc', async () => {
    const { token, user } = await registerAndGetToken();
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'My airdrop',
        description: 'A nice airdrop opportunity',
        official_link: 'https://example.com/drop',
        category: 'DeFi',
        chain: 'Ethereum',
        end_date: '2026-12-31',
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.submission).toMatchObject({
      title: 'My airdrop',
      description: 'A nice airdrop opportunity',
      official_link: 'https://example.com/drop',
      category: 'DeFi',
      chain: 'Ethereum',
      status: 'pending',
    });

    // DB 검증
    const docs = await Submission.find({});
    expect(docs).toHaveLength(1);
    expect(docs[0].submittedBy.toString()).toBe(user.id);
  });

  test('rejects without auth → 401', async () => {
    const res = await request(app).post('/api/submissions').send({
      title: 'x',
      description: 'y',
      official_link: 'https://z',
    });
    expect(res.status).toBe(401);
  });

  test.each([
    [{ description: 'd', official_link: 'l' }, 'no title'],
    [{ title: 't', official_link: 'l' }, 'no description'],
    [{ title: 't', description: 'd' }, 'no official_link'],
    [{}, 'empty body'],
  ])('rejects missing required fields → 400 (%s)', async (body, _label) => {
    const { token } = await registerAndGetToken({
      username: `u${Math.random().toString(36).slice(2, 8)}`,
      email: `${Math.random().toString(36).slice(2, 10)}@e.com`,
    });
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/필수/);
  });

  test('trims whitespace on saved fields', async () => {
    const { token } = await registerAndGetToken();
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: '  spaced  ',
        description: '  desc  ',
        official_link: '  https://link  ',
      });
    const doc = await Submission.findOne({});
    expect(doc.title).toBe('spaced');
    expect(doc.description).toBe('desc');
    expect(doc.official_link).toBe('https://link');
  });
});

describe('GET /api/submissions/mine', () => {
  test('returns only own submissions', async () => {
    const { token: tokenA, user: userA } = await registerAndGetToken({
      username: 'alice',
      email: 'alice@e.com',
    });
    const { token: tokenB } = await registerAndGetToken({
      username: 'bob',
      email: 'bob@e.com',
    });

    // alice 제보 2개
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A1', description: 'd', official_link: 'https://a1' });
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A2', description: 'd', official_link: 'https://a2' });
    // bob 제보 1개
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'B1', description: 'd', official_link: 'https://b1' });

    // alice가 본 mine
    const res = await request(app)
      .get('/api/submissions/mine')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const s of res.body.data) {
      expect(s.submittedBy.toString()).toBe(userA.id);
      expect(['A1', 'A2']).toContain(s.title);
    }
  });

  test('returns empty array when user has no submissions', async () => {
    const { token } = await registerAndGetToken();
    const res = await request(app)
      .get('/api/submissions/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('rejects without auth → 401', async () => {
    const res = await request(app).get('/api/submissions/mine');
    expect(res.status).toBe(401);
  });
});
