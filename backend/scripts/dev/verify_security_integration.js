// 보안 통합 검증 (수동 실행).
// 서버가 localhost:3000에서 떠 있어야 함 (npm start). dev 모드 가정.
//
// 검증:
//   1. helmet 헤더 (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security)
//   2. CORS dev fallback (Origin 헤더 임의 값도 통과)
//   3. rate-limit 일반 라우트 헤더 존재
//   4. rate-limit auth 그룹 6번째 호출 차단 (5/15min)
//   5. 입력 검증: 잘못된 이메일, 약한 비밀번호, 정상 케이스
//   6. JWT 토큰의 exp ≈ iat + 86400 (1일)
//   7. errorHandler — production이면 stack 제거 / dev에서는 stack 포함
//
// 실행: node scripts/dev/verify_security_integration.js

const http = require('http');
const jwt = require('jsonwebtoken');

const BASE = 'http://localhost:3000';
const random = () => Math.random().toString(36).slice(2, 10);
let passed = 0;
let failed = 0;

function expect(cond, name, detail) {
  if (cond) { console.log(`  ✓ ${name}`); passed++; }
  else { console.error(`  ✗ ${name} — ${detail || ''}`); failed++; }
}

function req(method, path, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch (_) { parsed = buf; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('\n[1] helmet 헤더');
  const r1 = await req('GET', '/api/airdrops');
  expect(r1.headers['x-frame-options'] !== undefined, 'X-Frame-Options 존재');
  expect(r1.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options=nosniff');
  expect(r1.headers['strict-transport-security'] !== undefined, 'Strict-Transport-Security 존재');

  console.log('\n[2] CORS dev fallback (임의 origin 통과)');
  const r2 = await req('GET', '/api/airdrops', { headers: { Origin: 'https://evil.example' } });
  expect(r2.status === 200, 'dev에선 임의 origin도 200 응답');

  console.log('\n[3] rate-limit 헤더 (RateLimit-*)');
  expect(r1.headers['ratelimit-limit'] !== undefined || r1.headers['ratelimit'] !== undefined,
    'RateLimit-* 헤더 존재', JSON.stringify({ keys: Object.keys(r1.headers).filter(k => k.startsWith('ratelimit')) }));

  // 순서 주의: auth rate-limit이 5/15min이라 register/login 호출 누적되면 [7]에서 차단됨.
  // → 입력 검증/JWT 검증을 먼저 (총 3회 호출), errorHandler는 별도 path, 마지막에 rate-limit 추가 호출.

  console.log('\n[4] 입력 검증 (register)');
  const r4a = await req('POST', '/api/auth/register', { body: { username: 'u'+random(), email: 'not-an-email', password: 'Abcd1234' } });
  expect(r4a.status === 400 && r4a.body.error === 'invalid_email', '잘못된 이메일 → 400 invalid_email', JSON.stringify(r4a.body));
  const r4b = await req('POST', '/api/auth/register', { body: { username: 'u'+random(), email: `t${random()}@example.com`, password: 'abc' } });
  expect(r4b.status === 400 && r4b.body.error === 'weak_password', '약한 비밀번호 → 400 weak_password', JSON.stringify(r4b.body));
  const r4c = await req('POST', '/api/auth/register', { body: { username: 'a', email: `t${random()}@example.com`, password: 'Abcd1234' } });
  expect(r4c.status === 400 && r4c.body.error === 'invalid_username', '짧은 사용자명 → 400 invalid_username', JSON.stringify(r4c.body));

  console.log('\n[5] JWT 토큰 exp 검증 (register 성공 케이스)');
  const username = 'jwtv' + random();
  const email = `jwtv_${random()}@example.com`;
  const password = 'Abcd1234';
  const r5 = await req('POST', '/api/auth/register', { body: { username, email, password } });
  if (r5.body && r5.body.token) {
    const decoded = jwt.decode(r5.body.token);
    const delta = decoded.exp - decoded.iat;
    const within1Day = Math.abs(delta - 86400) < 60;
    expect(within1Day, `JWT exp - iat ≈ 86400s (실제 ${delta}s)`, '1d 기본 만료');
  } else {
    expect(false, 'register 성공해 JWT 발급', `status ${r5.status} body=${JSON.stringify(r5.body)}`);
  }

  console.log('\n[5.5] 이메일 대소문자 차이로 중복 우회 시도');
  // [5]에서 가입한 email을 대문자로 변형해 재등록 → email_taken 기대 (500 generic 아님)
  const r55 = await req('POST', '/api/auth/register', {
    body: { username: 'dup' + random(), email: email.toUpperCase(), password: 'Abcd1234' },
  });
  expect(r55.status === 400 && r55.body.error === 'email_taken',
    '대문자 이메일로 중복 → 400 email_taken (500 아님)', JSON.stringify(r55.body));

  console.log('\n[6] errorHandler — dev에서 stack 포함, 응답 500');
  const r6 = await req('GET', '/api/_debug/throw');
  expect(r6.status === 500, 'status 500');
  expect(r6.body && r6.body.error === 'Internal Server Error', 'body.error = Internal Server Error');
  expect(typeof r6.body.stack === 'string', 'dev에서 stack 포함', `body keys=${Object.keys(r6.body||{}).join(',')}`);

  console.log('\n[7] auth rate-limit — 누적 5회 후 6번째 차단');
  // [4]: 3회, [5]: 1회, [5.5]: 1회 = 5회 누적. 다음 호출이 6번째 → 429
  const r71 = await req('POST', '/api/auth/register', { body: { username: 'u'+random(), email: 'x@y.z', password: 'p' } });
  expect(r71.status === 429, '6번째 호출 → 429', `got ${r71.status} body=${JSON.stringify(r71.body)}`);

  console.log(`\n결과: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
