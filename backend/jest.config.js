// Jest 설정 — 백엔드 단위 테스트.
// testEnvironment=node (브라우저 jsdom 불필요).
// setupFiles는 모든 테스트 파일 require 이전에 실행되어 환경변수를 주입한다
// (authMiddleware/authController가 require 시점에 JWT_SECRET 검증으로 throw하므로 필수).

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/__tests__/setupEnv.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  // node_modules와 통합 테스트용 helpers는 제외
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/', '/__tests__/setupEnv.js'],
  clearMocks: true,
  // mongodb-memory-server 첫 시작은 mongod 바이너리 다운로드/스폰이 있어 길게 잡는다.
  // 두 번째 이후엔 캐시 hit.
  testTimeout: 60000,
};
