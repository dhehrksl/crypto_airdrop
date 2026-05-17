// 라우트 그룹별 rate limit 미들웨어.
// 메모리 store (express-rate-limit 디폴트). 단일 인스턴스 환경에서 충분하며,
// 분산 배포 시 Redis store로 교체 필요 (별도 change).

const rateLimit = require('express-rate-limit');

// 공통 옵션
const COMMON = {
  standardHeaders: 'draft-7', // RateLimit-* 헤더
  legacyHeaders: false,       // X-RateLimit-* 비활성
};

// 인증 (브루트포스 방어) — 5회 / 15분
const authLimiter = rateLimit({
  ...COMMON,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'too_many_auth_requests', msg: '로그인/가입 요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

// 사용자 제보 (스팸 방어) — 10회 / 1시간
const submissionLimiter = rateLimit({
  ...COMMON,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: 'too_many_submissions', msg: '제보 요청이 너무 많습니다. 1시간 후 다시 시도하세요.' },
});

// 일반 — 100회 / 15분
const generalLimiter = rateLimit({
  ...COMMON,
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { error: 'too_many_requests', msg: '요청이 너무 많습니다.' },
});

module.exports = { authLimiter, submissionLimiter, generalLimiter };
