// 글로벌 에러 핸들러 — 모든 라우트 등록 후 마지막에 부착.
// 운영(production): 응답 본문에 일반화 메시지만, 스택/내부 상세 0.
// 개발(development): stack 포함하여 디버깅 편의.
// 내부 로깅(logger.error)은 환경 무관 항상 수행 (pino가 test에서 silent).

const logger = require('../src/lib/logger');

function errorHandler(err, req, res, _next) {
  const isProd = process.env.NODE_ENV === 'production';

  // 내부 로그는 항상 — 운영자가 추적 가능해야 함. pino-http가 req에 child logger를 붙이는데,
  // 그것을 쓰면 요청 컨텍스트(reqId 등)도 함께 출력됨.
  const log = req?.log || logger;
  log.error({ err, method: req.method, url: req.originalUrl }, '[error] request failed');

  // 이미 응답 시작됐으면 위임
  if (res.headersSent) return _next(err);

  const status = Number.isInteger(err && err.status) ? err.status : 500;
  const body = { error: 'Internal Server Error' };
  if (!isProd) {
    body.message = err && (err.message || String(err));
    body.stack = err && err.stack;
  }
  res.status(status).json(body);
}

module.exports = errorHandler;
