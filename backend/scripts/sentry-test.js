// Sentry DSN 동작 검증 스크립트.
//
// 운영 배포 후 1~2분 안에 Sentry로 이벤트가 실제로 전송되는지 확인하는 용도.
// dashboard에 의존하지 않고 transport 단의 ack(flush 성공/실패)를 종료 코드로 노출.
//
// 사용법:
//   # 로컬에서 .env에 SENTRY_DSN이 있으면 자동 사용
//   node scripts/sentry-test.js
//
//   # 직접 DSN을 주입해 테스트
//   SENTRY_DSN='https://xxx@o123.ingest.us.sentry.io/456' node scripts/sentry-test.js
//
// 종료 코드:
//   0 — captureMessage + captureException + flush 모두 성공. Sentry Issues 탭에서
//       "sentry-test: ..." 라벨로 확인 가능 (수신은 보통 수 초 내).
//   1 — DSN 미설정 / flush 타임아웃 / 예기치 못한 에러. 메시지로 원인 표시.
//
// instrument.js는 SENTRY_DSN이 비어있으면 init을 건너뛰는 가드를 가짐 — 이 스크립트는
// 그 가드를 미리 잡아 명확한 에러로 단축.

require('dotenv').config();

if (!process.env.SENTRY_DSN) {
  console.error('[sentry-test] FAIL — SENTRY_DSN 환경변수가 설정되어 있지 않습니다.');
  console.error('             .env에 SENTRY_DSN을 넣거나 명령 앞에 SENTRY_DSN=... 형태로 주입하세요.');
  process.exit(1);
}

// instrument를 require하면 Sentry.init이 호출됨. 이후 같은 패키지를 재require해도 캐시 hit.
require('../instrument');
const Sentry = require('@sentry/node');

async function main() {
  const dsn = process.env.SENTRY_DSN;
  const masked = dsn.length > 40 ? dsn.slice(0, 30) + '...' + dsn.slice(-8) : dsn;
  const env = process.env.NODE_ENV || 'development';
  const stamp = new Date().toISOString();

  console.log(`[sentry-test] DSN  : ${masked}`);
  console.log(`[sentry-test] env  : ${env}`);
  console.log(`[sentry-test] time : ${stamp}`);
  console.log('[sentry-test] sending test events...');

  // info-level 메시지 — Sentry "Issues" 탭에 표시되거나 (config에 따라) "Events"로만 기록.
  Sentry.captureMessage(`sentry-test: hello from CLI at ${stamp}`, 'info');

  // 합성 예외 — Issues 탭에 새 항목으로 만들어짐. 같은 메시지로 재실행하면 동일 issue에 묶임.
  const err = new Error(`sentry-test: synthetic error from CLI at ${stamp}`);
  err.tags = { source: 'sentry-test' };
  Sentry.captureException(err);

  // Sentry 전송은 비동기 → flush가 ack(또는 timeout) 받을 때까지 대기.
  // 5초면 정상 네트워크에서 충분. CI나 느린 환경은 더 길게 잡을 수 있음.
  const TIMEOUT_MS = Number(process.env.SENTRY_FLUSH_TIMEOUT_MS || 5000);
  console.log(`[sentry-test] flushing (timeout=${TIMEOUT_MS}ms)...`);
  const ok = await Sentry.flush(TIMEOUT_MS);

  if (ok) {
    console.log('[sentry-test] OK — events flushed to Sentry transport.');
    console.log('             Issues 탭에서 다음 라벨로 확인 가능 (수신까지 수 초 소요):');
    console.log('               - "sentry-test: hello from CLI ..."');
    console.log('               - "sentry-test: synthetic error from CLI ..."');
    process.exit(0);
  } else {
    console.error('[sentry-test] FAIL — flush timed out.');
    console.error('             확인:');
    console.error('               1) DSN이 올바른 프로젝트의 키인지');
    console.error('               2) 네트워크가 sentry.io로 outbound 접속 가능한지');
    console.error('               3) Sentry 프로젝트가 활성/quota 잔여 상태인지');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[sentry-test] unexpected error:', e && (e.stack || e.message || e));
  process.exit(1);
});
