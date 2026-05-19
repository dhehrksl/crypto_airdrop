// errorHandler 미들웨어 단위 테스트.
// req/res는 minimal mock — 실제 express app 부팅 없이 함수 호출만 검증.

const errorHandler = require('../middleware/errorHandler');
const logger = require('../src/lib/logger');

function makeRes() {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

function makeReq() {
  return { method: 'GET', originalUrl: '/api/test' };
}

describe('errorHandler middleware', () => {
  // 내부 logger.error는 항상 호출됨 — pino instance를 spy로 가로채 호출 카운트만 검증.
  let loggerSpy;
  beforeEach(() => {
    loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('production mode', () => {
    const orig = process.env.NODE_ENV;
    beforeAll(() => { process.env.NODE_ENV = 'production'; });
    afterAll(() => { process.env.NODE_ENV = orig; });

    test('returns generic "Internal Server Error" with no stack/message leak', () => {
      const err = new Error('Sensitive: DB at mongodb://secret-host:27017');
      err.stack = 'Error: Sensitive\n    at /app/secret.js:42';
      const res = makeRes();
      errorHandler(err, makeReq(), res, () => {});
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal Server Error' });
      expect(res.body).not.toHaveProperty('message');
      expect(res.body).not.toHaveProperty('stack');
    });

    test('uses err.status when integer', () => {
      const err = Object.assign(new Error('not found'), { status: 404 });
      const res = makeRes();
      errorHandler(err, makeReq(), res, () => {});
      expect(res.statusCode).toBe(404);
    });

    test('falls back to 500 when status is non-integer', () => {
      const err = Object.assign(new Error('x'), { status: 'oops' });
      const res = makeRes();
      errorHandler(err, makeReq(), res, () => {});
      expect(res.statusCode).toBe(500);
    });
  });

  describe('development mode', () => {
    const orig = process.env.NODE_ENV;
    beforeAll(() => { process.env.NODE_ENV = 'development'; });
    afterAll(() => { process.env.NODE_ENV = orig; });

    test('includes message and stack in response body', () => {
      const err = new Error('boom');
      err.stack = 'Error: boom\n    at /app/foo.js:1';
      const res = makeRes();
      errorHandler(err, makeReq(), res, () => {});
      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: 'Internal Server Error',
        message: 'boom',
        stack: expect.stringContaining('Error: boom'),
      });
    });
  });

  describe('headersSent branch', () => {
    test('delegates to next when response already started', () => {
      const err = new Error('late');
      const res = makeRes();
      res.headersSent = true;
      const next = jest.fn();
      errorHandler(err, makeReq(), res, next);
      expect(next).toHaveBeenCalledWith(err);
      // res.status/json은 호출 안 됐어야 함
      expect(res.statusCode).toBe(200); // 초기값 유지
      expect(res.body).toBeNull();
    });
  });

  test('logs every error to logger.error with structured context (방어선)', () => {
    const err = new Error('logged');
    errorHandler(err, makeReq(), makeRes(), () => {});
    expect(loggerSpy).toHaveBeenCalled();
    // pino API: logger.error(contextObj, message)
    const [ctx, msg] = loggerSpy.mock.calls[0];
    expect(ctx).toMatchObject({ method: 'GET', url: '/api/test' });
    expect(ctx.err).toBe(err);
    expect(msg).toContain('[error]');
  });
});
