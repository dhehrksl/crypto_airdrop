// Jest setupFiles — 모든 테스트 모듈 require 이전에 실행.
// authMiddleware/authController 등은 require 시점에 process.env.JWT_SECRET 부재 시
// throw하기 때문에, 테스트 환경에서도 임의의 강한 시크릿을 미리 주입해야 한다.
//
// 실제 운영 시크릿과 무관한 더미 값. .env 파일을 읽지 않는다 (테스트는 격리).

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// pino logger는 NODE_ENV=test일 때 자동으로 silent지만, 명시적으로 한 번 더 확정.
// 통합 테스트에서 라우트가 pino-http를 호출하면 그것까지 같이 silent.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-only-secret-' + 'x'.repeat(40);
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
// scraper admin 인증 분기를 통합 테스트에서 검증하려면 토큰이 설정되어 있어야 한다
// (값이 비어 있으면 requireAdminToken이 모든 요청을 통과시킴 — dev 편의 동작).
process.env.SCRAPER_ADMIN_TOKEN =
  process.env.SCRAPER_ADMIN_TOKEN || 'test-scraper-admin-token-' + 'y'.repeat(32);
