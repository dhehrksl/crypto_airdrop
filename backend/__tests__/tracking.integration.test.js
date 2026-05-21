// 워치리스트 + 단계별 진행 추적 API 통합 테스트 (airdrop-tracking-toolkit).

jest.mock('../src/services/scraper', () => ({
  runScraper: jest.fn().mockResolvedValue({ stubbed: true }),
}));

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Airdrop = require('../models/Airdrop');
const AirdropTracking = require('../models/AirdropTracking');
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

let hashCounter = 0;

async function registerAndGetToken(overrides = {}) {
  const body = {
    username: 'trackuser',
    email: 'track@example.com',
    password: 'abcd1234',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 200) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

async function createAirdrop(overrides = {}) {
  return Airdrop.create({
    title: 'Test Airdrop',
    description: 'desc',
    official_link: 'https://example.com/drop',
    trend_score: 50,
    source: ['test'],
    unique_hash: `hash-${hashCounter++}`,
    tasks: ['Step 1', 'Step 2', 'Step 3'],
    ...overrides,
  });
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('워치리스트 API', () => {
  test('관심 추가 → 200, DB에 watchlisted 문서 생성', async () => {
    const { token, user } = await registerAndGetToken();
    const airdrop = await createAirdrop();

    const res = await request(app)
      .post(`/api/user/airdrops/${airdrop._id}/watchlist`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.watchlisted).toBe(true);
    const doc = await AirdropTracking.findOne({ user: user.id, airdrop: airdrop._id });
    expect(doc.watchlisted).toBe(true);
  });

  test('관심 추가는 멱등 — 두 번 추가해도 문서는 하나', async () => {
    const { token, user } = await registerAndGetToken();
    const airdrop = await createAirdrop();

    await request(app).post(`/api/user/airdrops/${airdrop._id}/watchlist`).set(auth(token));
    await request(app).post(`/api/user/airdrops/${airdrop._id}/watchlist`).set(auth(token));

    const docs = await AirdropTracking.find({ user: user.id, airdrop: airdrop._id });
    expect(docs).toHaveLength(1);
  });

  test('관심 제거 → watchlisted false', async () => {
    const { token } = await registerAndGetToken();
    const airdrop = await createAirdrop();

    await request(app).post(`/api/user/airdrops/${airdrop._id}/watchlist`).set(auth(token));
    const res = await request(app)
      .delete(`/api/user/airdrops/${airdrop._id}/watchlist`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.watchlisted).toBe(false);
  });

  test('존재하지 않는 에어드랍 추가 → 404', async () => {
    const { token } = await registerAndGetToken();
    const ghostId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/user/airdrops/${ghostId}/watchlist`)
      .set(auth(token));

    expect(res.status).toBe(404);
  });

  test('관심 목록 조회는 본인 것만 반환한다', async () => {
    const a = await registerAndGetToken({ username: 'usera', email: 'a@example.com' });
    const b = await registerAndGetToken({ username: 'userb', email: 'b@example.com' });
    const airdrop = await createAirdrop();

    await request(app).post(`/api/user/airdrops/${airdrop._id}/watchlist`).set(auth(a.token));

    const resA = await request(app).get('/api/user/airdrops/watchlist').set(auth(a.token));
    const resB = await request(app).get('/api/user/airdrops/watchlist').set(auth(b.token));

    expect(resA.body.data).toHaveLength(1);
    expect(resB.body.data).toHaveLength(0);
  });

  test('인증 없이 관심 목록 조회 → 401', async () => {
    const res = await request(app).get('/api/user/airdrops/watchlist');
    expect(res.status).toBe(401);
  });
});

describe('단계별 진행 API', () => {
  test('단계 체크 → completedTasks에 인덱스 추가, totalTasks 반환', async () => {
    const { token } = await registerAndGetToken();
    const airdrop = await createAirdrop(); // tasks 3개

    const res = await request(app)
      .put(`/api/user/airdrops/${airdrop._id}/tasks/0`)
      .set(auth(token))
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.completedTasks).toEqual([0]);
    expect(res.body.totalTasks).toBe(3);
  });

  test('단계 해제 → completedTasks에서 제거', async () => {
    const { token } = await registerAndGetToken();
    const airdrop = await createAirdrop();

    await request(app)
      .put(`/api/user/airdrops/${airdrop._id}/tasks/1`)
      .set(auth(token))
      .send({ completed: true });
    const res = await request(app)
      .put(`/api/user/airdrops/${airdrop._id}/tasks/1`)
      .set(auth(token))
      .send({ completed: false });

    expect(res.status).toBe(200);
    expect(res.body.completedTasks).toEqual([]);
  });

  test('범위를 벗어난 단계 인덱스 → 400', async () => {
    const { token } = await registerAndGetToken();
    const airdrop = await createAirdrop(); // tasks 3개 (유효 인덱스 0~2)

    const res = await request(app)
      .put(`/api/user/airdrops/${airdrop._id}/tasks/5`)
      .set(auth(token))
      .send({ completed: true });

    expect(res.status).toBe(400);
  });

  test('tasks 없는 에어드랍 — tracking 조회 시 totalTasks 0', async () => {
    const { token } = await registerAndGetToken();
    const airdrop = await createAirdrop({ tasks: undefined });

    const res = await request(app)
      .get(`/api/user/airdrops/${airdrop._id}/tracking`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.totalTasks).toBe(0);
    expect(res.body.completedTasks).toEqual([]);
    expect(res.body.watchlisted).toBe(false);
  });

  test('인증 없이 단계 체크 → 401', async () => {
    const airdrop = await createAirdrop();
    const res = await request(app)
      .put(`/api/user/airdrops/${airdrop._id}/tasks/0`)
      .send({ completed: true });
    expect(res.status).toBe(401);
  });
});
