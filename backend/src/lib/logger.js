// 구조화된 로거(pino) 단일 인스턴스.
//
// 환경별 동작:
//   - production : JSON 한 줄 출력 (Render/CloudWatch 같은 로그 파이프라인 친화)
//   - development: pino-pretty로 컬러/포맷팅 (사람이 읽기 좋게)
//   - test       : silent (Jest 출력 노이즈 차단)
//
// 명시적으로 LOG_LEVEL을 주면 위 기본을 덮어쓴다.
//
// 보안: redact로 비밀번호/토큰/Authorization 헤더 자동 마스킹.
// 사용 예:
//   logger.info({ userId }, 'user created');
//   logger.error({ err }, 'failed to create user');
//
// 절대 `logger.info('user', userId)` 같이 멀티 인자로 쓰지 말 것 — pino는
// 두 번째 인자만 메시지로, 첫 인자는 객체로 본다. 변수는 `{ ... }`에 담는다.

const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const level =
  process.env.LOG_LEVEL || (isTest ? 'silent' : isProd ? 'info' : 'debug');

const transport =
  !isProd && !isTest
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined;

const logger = pino({
  level,
  transport,
  // err 객체는 stack 포함해서 자동 직렬화
  serializers: pino.stdSerializers,
  // 민감 정보 자동 마스킹 — req/res/body 어디에 와도 모두 잡음
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      'Authorization',
      'headers.authorization',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
