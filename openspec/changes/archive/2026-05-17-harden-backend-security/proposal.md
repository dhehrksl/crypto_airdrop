## Why

출시 전 audit에서 백엔드의 baseline 보안이 PoC 수준임이 드러났다. 구체적으로 `app.use(cors())`가 모든 origin을 허용해 정상 도메인 외 출처가 세션 토큰을 탈취할 수 있고(`server.js:18`), `helmet` 등 표준 보안 헤더가 전무해 XSS·clickjacking·MIME sniffing 공격에 무방비이며, `/api/auth/register`·`/api/submissions` 등 비싼 엔드포인트에 rate limiting이 없어 브루트포스/스팸이 가능하다. 또한 회원가입 시 이메일 형식·비밀번호 강도 검증이 없고(`authController.js:12-18`), 글로벌 에러 핸들러가 없어 운영 환경의 Express 기본 핸들러가 스택트레이스를 응답에 노출할 수 있다. JWT 만료가 7일로 길어 토큰 탈취 시 영향이 길게 지속된다. 광고 수익 모델로 출시할 앱이 외부에 노출되는 시점이기 때문에, 이 baseline은 출시 가능 여부의 명확한 차단 항목이다.

## What Changes

- **CORS 정책 화이트리스트화** — `CORS_ALLOWED_ORIGINS` 환경변수에서 쉼표 구분 origin 목록을 읽어 그 외 origin은 차단. 미설정 시 개발용 fallback(`*`)을 사용하되 부팅 시 보안 경고 출력.
- **helmet 미들웨어 추가** — 표준 보안 헤더 일괄 적용. API-only 응답이라 CSP는 기본 비활성, 그 외 옵션은 helmet 디폴트.
- **express-rate-limit 도입** — 라우트 그룹별 한도:
  - 인증(`/api/auth/*`): IP당 5회/15분 (브루트포스 방어)
  - 제출(`/api/submissions`): IP당 10회/시간 (스팸 방어)
  - 일반: IP당 100회/15분 (DoS 완화)
  - 스크래퍼는 기존 토큰+쿨다운으로 충분 — rate limit 추가 적용 안 함
- **입력 검증 강화** — 회원가입에서 이메일 형식(RFC 5322 호환) 정규식 + 비밀번호 최소 8자 + 영문/숫자 각 1개 이상. 라이브러리 없이 컨트롤러에서 직접 검증(가벼움).
- **JWT 만료 단축** — 기본 7일 → **1일**. `JWT_EXPIRES_IN` 환경변수로 override 가능.
- **글로벌 에러 핸들러** — 모든 라우트 뒤에 `app.use((err, req, res, next) => ...)`. 운영 환경에서는 일반화 메시지만 응답, dev에서만 스택 포함. 내부 로깅은 항상.
- **부팅 시 보안 자가 진단 로그** — JWT_SECRET 기본값, CORS 미설정, Google OAuth dummy 같은 위험 설정을 부팅 시 한 번 경고 출력.

## Capabilities

### New Capabilities
- `backend-security`: 백엔드의 baseline 보안 정책 (CORS, 보안 헤더, rate limit, 입력 검증, 에러 응답, 인증 토큰 수명, 부팅 시 자가 진단). 기능적 capability가 아니라 횡단 정책이라 별도 capability로 분리해 향후 보안 관련 change가 같은 capability에 누적되게 한다.

### Modified Capabilities
<!-- 기존 spec에 해당 항목 없음 -->

## Impact

**코드**
- `backend/server.js`: cors 옵션 변경, helmet/rate-limit 미들웨어 등록, 글로벌 에러 핸들러 등록, 부팅 자가 진단 로그
- `backend/middleware/securityHeaders.js`(또는 server.js에 inline): helmet 설정
- `backend/middleware/rateLimits.js` 신규: 라우트 그룹별 limiter 정의 + export
- `backend/middleware/errorHandler.js` 신규: 글로벌 에러 핸들러
- `backend/controllers/authController.js`: 이메일/비밀번호 검증 + JWT 만료 환경변수화
- `backend/.env`: `CORS_ALLOWED_ORIGINS`, `JWT_EXPIRES_IN`, `NODE_ENV` 항목 추가(기본값 안내)

**의존성**
- `helmet` 신규 (작음, 표준)
- `express-rate-limit` 신규 (작음, 메모리 store 디폴트로 단일 인스턴스에서 충분)

**범위 밖**
- 인프라급 보안(WAF, DDoS 완화, CDN/Cloudflare): 호스팅 결정 이후 단계
- 2FA / CSRF for SPA / OAuth provider 추가
- 보안 모니터링·SIEM 연동
- 비밀번호 정책 추가 강화(특수문자 강제, 사전 단어 차단 등)는 사용자 마찰 우려로 본 change에선 보류
