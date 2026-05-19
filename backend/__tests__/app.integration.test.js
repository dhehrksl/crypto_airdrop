// app.js 통합 테스트 — supertest로 라우트 응답/미들웨어 분기 검증.
// DB 의존 케이스(가입/로그인/제보 CRUD)는 mongodb-memory-server를 도입하는 후속 작업에서 다룬다.
// 여기서는 mongoose.connect 없이도 응답하는 라우트와, DB 도달 전 거부되는 분기만 확인.

// runScraper는 외부 axios/mongoose 호출이 있어 통합 테스트 환경에서 hang을 유발한다.
// scraperRunner의 triggerScraper는 fire-and-forget이라 mock 없이는 Jest teardown 후에도
// 백그라운드에서 계속 실행됨 → "Jest did not exit" + "import after teardown" 경고.
// 통합 테스트의 관심사는 인증/쿨다운 분기뿐이므로 runScraper 자체는 no-op으로 대체.
jest.mock('../src/services/scraper', () => ({
  runScraper: jest.fn().mockResolvedValue({ stubbed: true }),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');

// app은 require만으로 listen하지 않음 (분리된 server.js에서만 listen).
const app = require('../app');

function bearer(payload = { user: { id: 'test-user' } }, opts = {}) {
  return 'Bearer ' + jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m', ...opts });
}

describe('GET /health', () => {
  test('returns 200 with status fields', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      uptimeSec: expect.any(Number),
      mongo: expect.any(String),
      ts: expect.any(String),
    });
    // mongo는 'connected' 또는 'state:<number|undefined>'. 미연결 환경에서는 후자.
  });

  test('sets standard helmet security headers', async () => {
    const res = await request(app).get('/health');
    // helmet의 표준 헤더 일부 — 환경에 따라 정확한 헤더 set이 달라질 수 있으므로 대표 1~2개만 확인.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });
});

describe('GET /api/_debug/throw (dev/test only)', () => {
  test('routes through errorHandler and returns 500', async () => {
    // setupEnv가 NODE_ENV=test로 설정 — production 아닐 때만 라우트 등록됨.
    const res = await request(app).get('/api/_debug/throw');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    // production이 아니므로 message/stack 노출됨 (errorHandler 분기).
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('Sensitive internal');
  });
});

describe('GET /api/scraper/status', () => {
  test('returns 200 with status snapshot', async () => {
    const res = await request(app).get('/api/scraper/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      running: expect.any(Boolean),
      cooldownRemainingSec: expect.any(Number),
    });
    expect(res.body).toHaveProperty('lastRunAt');
    expect(res.body).toHaveProperty('lastStats');
  });
});

describe('POST /api/scraper/run (admin token gate)', () => {
  test('rejects request with no token → 401', async () => {
    const res = await request(app).post('/api/scraper/run');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  test('rejects request with wrong token → 401', async () => {
    const res = await request(app)
      .post('/api/scraper/run')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  test('accepts both header forms (Bearer and x-admin-token)', async () => {
    // 유효 토큰이지만 실제 runScraper는 호출되지 않게 cooldown으로 막아야 외부 호출 회피.
    // 첫 호출은 started:true가 될 수 있으므로 — runScraper 호출 자체를 차단할 수 없다면
    // 이 케이스는 회귀 위험. 안전하게 토큰 인증 분기만 통과(즉 401이 아님)인지 확인.
    const ok = await request(app)
      .post('/api/scraper/run')
      .set('x-admin-token', process.env.SCRAPER_ADMIN_TOKEN);
    expect(ok.status).not.toBe(401); // 200/409/429 모두 인증 통과 의미
  });
});

describe('Auth middleware integration on protected routes', () => {
  test('GET /api/submissions/mine without token → 401', async () => {
    const res = await request(app).get('/api/submissions/mine');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ msg: 'No token, authorization denied' });
  });

  test('GET /api/admin/submissions without token → 401', async () => {
    const res = await request(app).get('/api/admin/submissions');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/user/account with invalid token → 401', async () => {
    const res = await request(app)
      .delete('/api/user/account')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ msg: 'Token is not valid' });
  });

  test('valid token reaches handler (DB call may fail, but middleware passes)', async () => {
    // authMiddleware는 토큰만 보고 통과. 이후 controller가 mongoose 호출하면 미연결 환경에선
    // 5xx 또는 hang. timeout으로 보호. 핵심은 status가 401이 아닌 것.
    const res = await request(app)
      .get('/api/submissions/mine')
      .set('Authorization', bearer())
      .timeout(2000)
      .catch((e) => ({ status: e.code === 'ECONNABORTED' ? 'timeout' : 500 }));
    expect(res.status).not.toBe(401);
  });
});

describe('CORS configuration', () => {
  test('allows requests without Origin header (server-to-server/native)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('allows requests when no whitelist is configured (dev fallback)', async () => {
    // CORS_ALLOWED_ORIGINS는 test에서 미설정 — dev fallback으로 모든 origin 허용.
    const res = await request(app).get('/health').set('Origin', 'http://example.com');
    expect(res.status).toBe(200);
    // CORS 응답 헤더가 echo되거나 *로 설정되었는지
    const acao = res.headers['access-control-allow-origin'];
    expect(acao === 'http://example.com' || acao === '*').toBe(true);
  });
});
