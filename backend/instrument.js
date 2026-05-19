// Sentry 초기화 — 반드시 다른 모든 require()보다 먼저 로드되어야 한다.
// (@sentry/node v9는 OpenTelemetry 기반 자동 계측을 사용하기 때문에 express/mongoose 등
//  계측 대상 모듈이 로드되기 전에 init이 끝나 있어야 자동으로 감싼다.)
//
// 사용법: server.js 최상단에서 `require('./instrument');` (dotenv 직후).
// SENTRY_DSN이 비어있으면 init을 건너뛴다 — 개발/로컬에서 노이즈 방지.

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

const dsn = process.env.SENTRY_DSN || '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,

    // 트레이스 샘플링 — 운영은 비용 절감 위해 낮게, 개발은 100%.
    // 필요 시 SENTRY_TRACES_SAMPLE_RATE로 덮어쓰기.
    tracesSampleRate: Number(
      process.env.SENTRY_TRACES_SAMPLE_RATE ||
        (process.env.NODE_ENV === 'production' ? 0.1 : 1.0)
    ),

    // 프로파일링 — traces가 캡쳐된 트랜잭션 한정으로 적용된다.
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),

    integrations: [nodeProfilingIntegration()],

    // 민감 정보 차단 — req.body의 password/token 등 자동 마스킹.
    sendDefaultPii: false,

    beforeSend(event) {
      // request body 전부 제거 (인증/제보 페이로드에 민감값 포함 가능)
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });

  // logger는 instrument 이후에 require되어야 OpenTelemetry 호환. 부팅 시 1회성 출력은
  // process.stdout.write로 충분 — 구조화된 로그는 logger를 통해 부팅 후에 흐른다.
  process.stdout.write(`[Sentry] initialized env=${process.env.NODE_ENV || 'development'}\n`);
} else if (process.env.NODE_ENV === 'production') {
  process.stderr.write('[Sentry] SENTRY_DSN 미설정 — 운영 에러 트래킹이 비활성화됩니다.\n');
}

module.exports = Sentry;
