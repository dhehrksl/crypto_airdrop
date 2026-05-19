// 인증 라우트 DB 통합 테스트.
// mongodb-memory-server로 실제 mongoose 연산을 통과시키되 네트워크/외부 의존은 격리.

// scraperRunner 호출은 통합 테스트와 무관 — 백그라운드 hang 방지로 mock.
jest.mock('../src/services/scraper', () => ({
  runScraper: jest.fn().mockResolvedValue({ stubbed: true }),
}));

const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
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

describe('POST /api/auth/register', () => {
  test('creates user with valid input and returns token + user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'tester01',
      email: 'a@b.com',
      password: 'abcd1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      username: 'tester01',
      email: 'a@b.com',
      isAdmin: false,
    });
    expect(res.body.user).toHaveProperty('id');

    // DB 검증 — bcrypt로 해싱되어 평문 저장 안 됨
    const u = await User.findOne({ email: 'a@b.com' });
    expect(u).not.toBeNull();
    expect(u.password).not.toBe('abcd1234');
    expect(u.password.startsWith('$2')).toBe(true); // bcrypt 시그니처
  });

  test('normalizes email and username to lowercase', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'MixedCase',
      email: 'UPPER@Example.COM',
      password: 'abcd1234',
    });
    expect(res.status).toBe(200);
    const u = await User.findOne({});
    expect(u.email).toBe('upper@example.com');
    expect(u.username).toBe('mixedcase');
  });

  test.each([
    [{ email: 'a@b.com', password: 'abcd1234' }, 'missing_fields'], // no username
    [{ username: 'x', password: 'abcd1234' }, 'missing_fields'],    // no email
    [{ username: 'x', email: 'a@b.com' }, 'missing_fields'],        // no password
    [{}, 'missing_fields'],
  ])('rejects missing fields → 400 %o', async (body, expectedError) => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(expectedError);
  });

  test('rejects invalid email format → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'tester',
      email: 'not-an-email',
      password: 'abcd1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  test.each([
    ['short1', 'too_short'],
    ['abcdefgh', 'no_digit'],
    ['12345678', 'no_letter'],
  ])('rejects weak password %s → 400 (%s)', async (password, reason) => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'tester',
      email: 'a@b.com',
      password,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('weak_password');
    expect(res.body.reason).toBe(reason);
  });

  test.each([
    ['ab', 'too_short'],
    ['a'.repeat(21), 'too_long'],
    ['has space', 'invalid_chars'],
  ])('rejects invalid username %s → 400 (%s)', async (username, reason) => {
    const res = await request(app).post('/api/auth/register').send({
      username,
      email: 'a@b.com',
      password: 'abcd1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_username');
    expect(res.body.reason).toBe(reason);
  });

  test('rejects duplicate email → 400 email_taken', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'first',
      email: 'dup@example.com',
      password: 'abcd1234',
    });
    const res = await request(app).post('/api/auth/register').send({
      username: 'second',
      email: 'dup@example.com',
      password: 'abcd1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('email_taken');
  });

  test('rejects duplicate username → 400 username_taken', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'sameuser',
      email: 'a@b.com',
      password: 'abcd1234',
    });
    const res = await request(app).post('/api/auth/register').send({
      username: 'sameuser',
      email: 'c@d.com',
      password: 'abcd1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('username_taken');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // 직접 controller 호출 대신 register 라우트로 가입 — 실제 흐름과 동일
    await request(app).post('/api/auth/register').send({
      username: 'loginuser',
      email: 'login@example.com',
      password: 'Pass1234',
    });
  });

  test('returns token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'Pass1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('login@example.com');
  });

  test('is case-insensitive on email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'LOGIN@Example.COM',
      password: 'Pass1234',
    });
    expect(res.status).toBe(200);
  });

  test('rejects wrong password → 400 invalid_credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'WrongPass1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_credentials');
  });

  test('rejects nonexistent email → 400 invalid_credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Pass1234',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_credentials');
  });

  test('rejects missing fields → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_fields');
  });
});
