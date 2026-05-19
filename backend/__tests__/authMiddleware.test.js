// authMiddleware 단위 테스트.
// jsonwebtoken을 실제로 사용 — setupEnv에서 주입한 JWT_SECRET으로 토큰 발급/검증.

const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function signTestToken(payload, opts = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m', ...opts });
}

describe('authMiddleware', () => {
  test('rejects request with no Authorization header → 401', () => {
    const req = { header: () => undefined };
    const res = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ msg: 'No token, authorization denied' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects malformed header (no Bearer prefix) → 401', () => {
    const token = signTestToken({ user: { id: 'u1' } });
    const req = { header: (k) => (k === 'Authorization' ? token : undefined) };
    const res = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ msg: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects wrong prefix (Token <jwt>) → 401', () => {
    const token = signTestToken({ user: { id: 'u1' } });
    const req = { header: () => `Token ${token}` };
    const res = makeRes();
    authMiddleware(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ msg: 'Token is not valid' });
  });

  test('rejects tampered/forged token → 401', () => {
    const forged = jwt.sign({ user: { id: 'attacker' } }, 'wrong-secret');
    const req = { header: () => `Bearer ${forged}` };
    const res = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ msg: 'Token is not valid' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('rejects expired token → 401', () => {
    // 1초 전에 만료된 토큰 — 음수 expiresIn 미지원이라 0초 후 setTimeout 대신
    // 직접 iat/exp 페이로드로 sign.
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = jwt.sign(
      { user: { id: 'u1' }, iat: past, exp: past + 1 },
      process.env.JWT_SECRET
    );
    const req = { header: () => `Bearer ${expired}` };
    const res = makeRes();
    authMiddleware(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  test('accepts valid token, populates req.user, calls next', () => {
    const token = signTestToken({ user: { id: 'user-123' } });
    const req = { header: () => `Bearer ${token}` };
    const res = makeRes();
    const next = jest.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 'user-123' });
    // 응답은 건드리지 않음
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });
});
