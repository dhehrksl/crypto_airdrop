# backend-security Specification

## Purpose
TBD - created by archiving change harden-backend-security. Update Purpose after archive.
## Requirements
### Requirement: CORS는 명시적 화이트리스트로 제한되어야 한다

운영 환경에서 백엔드는 `CORS_ALLOWED_ORIGINS` 환경변수에 명시된 origin만 허용해야 한다(MUST). `NODE_ENV=production`이면서 `CORS_ALLOWED_ORIGINS`가 비어 있으면 서버는 부팅을 거부해야 한다(MUST). 개발 환경(dev/test)에서 환경변수가 비어 있으면 모든 origin을 허용하되 보안 경고 로그를 1회 출력해야 한다(SHALL).

#### Scenario: 화이트리스트에 포함된 origin
- **WHEN** 클라이언트가 `Origin: https://app.example.com` 으로 요청하고 `CORS_ALLOWED_ORIGINS=https://app.example.com` 이다
- **THEN** 응답 헤더에 `Access-Control-Allow-Origin: https://app.example.com` 이 포함되고 정상 처리된다

#### Scenario: 화이트리스트에 없는 origin
- **WHEN** 클라이언트가 `Origin: https://evil.com` 으로 요청하고 `CORS_ALLOWED_ORIGINS=https://app.example.com` 이다
- **THEN** preflight/실제 응답에서 CORS 정책으로 거부되고 서버 로그에 `[CORS] blocked origin: https://evil.com`이 기록된다

#### Scenario: 운영 환경에서 화이트리스트 미설정 — 부팅 거부
- **WHEN** `NODE_ENV=production`이고 `CORS_ALLOWED_ORIGINS`가 비어 있다
- **THEN** 서버는 부팅 시 명시적 에러로 종료하고 process exit code는 비-0이다

### Requirement: 표준 보안 헤더가 모든 응답에 적용되어야 한다

시스템은 `helmet` 미들웨어를 적용해 X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy 등 표준 보안 헤더가 모든 응답에 포함되도록 해야 한다(MUST). API-only 서비스 특성상 CSP는 비활성화하되, 정적 자산 서빙이 도입되면 재검토한다.

#### Scenario: 일반 응답
- **WHEN** 클라이언트가 `GET /api/airdrops`를 호출한다
- **THEN** 응답 헤더에 `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=...`이 포함된다

### Requirement: 인증/제출 엔드포인트에 rate limit가 적용되어야 한다

시스템은 라우트 그룹별로 IP 기반 rate limit를 적용해야 한다(MUST):
- `/api/auth/*` (login, register, oauth 콜백): IP당 **5회 / 15분**
- `/api/submissions` (사용자 제보 생성): IP당 **10회 / 1시간**
- 그 외 일반 라우트: IP당 **100회 / 15분**

스크래퍼 트리거(`/api/scraper/run`)는 기존 admin 토큰 + 30분 쿨다운으로 보호되므로 본 rate limit 적용에서 제외한다.

#### Scenario: 인증 한도 초과
- **WHEN** 같은 IP에서 15분 안에 `/api/auth/login`을 6회 호출한다
- **THEN** 6번째 호출이 `429 Too Many Requests` 응답을 받고 `Retry-After` 헤더가 포함된다

#### Scenario: 일반 read 라우트는 충분히 관대
- **WHEN** 같은 IP에서 1분 안에 `/api/airdrops`를 60회 호출한다
- **THEN** 모두 정상 응답(200)을 받는다 (한도 100/15min 안)

#### Scenario: 스크래퍼 엔드포인트는 분리된 정책
- **WHEN** `/api/scraper/run`을 짧은 시간에 여러 번 호출한다
- **THEN** 거절 사유는 admin 토큰 또는 쿨다운(409/429)이지 본 rate limit가 아니다

### Requirement: 회원가입 입력은 형식·강도·데이터 무결성 검증을 모두 거쳐야 한다

회원가입(`POST /api/auth/register`)은 다음 모두를 만족해야 한다(MUST):

- 이메일이 RFC 5322 호환 정규식을 만족하지 않으면 `400 { error: "invalid_email" }` 반환
- 비밀번호가 **최소 8자, 영문 1자 이상, 숫자 1자 이상**을 만족하지 않으면 `400 { error: "weak_password" }` 반환
- 사용자명이 형식(3-20자)을 만족하지 않으면 `400 { error: "invalid_username" }` 반환
- 이메일·사용자명은 저장·중복 비교 전에 **trim + lowercase 정규화**되어야 한다 — `User@Example.com`과 `user@example.com`이 동일 사용자로 취급되어야 함
- `username` 필드는 모델 레벨에 unique index가 있어야 한다 — race condition 방지
- 정규화된 값으로 중복 체크 통과 후 `save` 시 `E11000 duplicate key error`가 발생하면 명시적으로 `400 { error: "duplicate", field: <field> }`로 변환해야 하며(MUST) `500 generic error`로 빠져서는 안 된다(MUST NOT)

#### Scenario: 잘못된 이메일 형식
- **WHEN** 클라이언트가 `email: "not-an-email"`로 register를 호출한다
- **THEN** `400 { error: "invalid_email" }` 응답을 받고 사용자가 생성되지 않는다

#### Scenario: 약한 비밀번호
- **WHEN** 클라이언트가 유효 이메일 + `password: "abc"`로 register를 호출한다
- **THEN** `400 { error: "weak_password" }` 응답을 받고 사용자가 생성되지 않는다

#### Scenario: 정상 입력
- **WHEN** 클라이언트가 `email: "u@example.com"` + `password: "Abcd1234"`로 register를 호출한다
- **THEN** 사용자가 생성되고 JWT를 응답으로 받는다

#### Scenario: 사용자명 형식 위반
- **WHEN** 클라이언트가 정상 이메일·비밀번호 + `username: "a"` (1자)로 register를 호출한다
- **THEN** `400 { error: "invalid_username" }` 응답을 받는다

#### Scenario: 이메일 대소문자 차이로 인한 중복 우회 시도
- **WHEN** `user@example.com`로 이미 가입된 상태에서 같은 클라이언트가 `USER@Example.COM`로 register를 호출한다
- **THEN** `400 { error: "email_taken" }` (또는 동등한 명시적 응답)을 받고, `500 generic error`로 빠지지 않는다

#### Scenario: race condition으로 인한 E11000
- **WHEN** 두 요청이 거의 동시에 같은 사용자명/이메일로 register를 호출하여 `findOne` 중복 체크는 둘 다 통과하고 `save` 단계에서 한쪽이 E11000을 받는다
- **THEN** 그 요청은 `400 { error: "duplicate", field: <field> }` 응답을 받는다 (500 아님)

### Requirement: 에러 응답에 스택트레이스나 내부 메시지가 노출되어서는 안 된다

시스템은 글로벌 에러 핸들러를 등록하여(MUST) 처리되지 않은 모든 에러를 가로채야 한다. 운영 환경(`NODE_ENV=production`)에서 응답 본문은 `{ error: "Internal Server Error" }`로 일반화되어야 하고(MUST NOT 내부 메시지/스택 노출), 개발 환경에서는 디버깅 편의를 위해 `stack` 필드를 포함할 수 있다(MAY). 내부 로깅(console.error)은 환경과 무관하게 항상 수행된다.

#### Scenario: 운영 환경의 처리되지 않은 에러
- **WHEN** `NODE_ENV=production`이고 어떤 라우트가 `throw new Error("DB connection lost: mongodb://...")` 한다
- **THEN** 클라이언트는 `500 { error: "Internal Server Error" }`만 받고, 응답 본문에 "DB connection lost", "mongodb://", 스택트레이스가 모두 포함되지 않는다

#### Scenario: 개발 환경의 처리되지 않은 에러
- **WHEN** `NODE_ENV=development`에서 같은 에러가 발생한다
- **THEN** 응답 본문에 `error`와 `stack` 필드가 포함될 수 있다

### Requirement: JWT 토큰의 기본 만료 시간은 1일이어야 한다

`authController`에서 발급하는 모든 JWT의 `expiresIn`은 기본 **`1d`** 이어야 하며(MUST), `JWT_EXPIRES_IN` 환경변수로 override 가능해야 한다(SHALL). 만료된 토큰으로 보호된 라우트에 접근 시 `401`을 반환해야 한다(MUST).

#### Scenario: 발급된 토큰의 exp 클레임
- **WHEN** 사용자가 정상 로그인하여 JWT를 받는다
- **THEN** 토큰의 `exp` 클레임이 `iat + 24시간` 또는 `JWT_EXPIRES_IN` 환경변수 값에 해당한다

#### Scenario: 만료된 토큰
- **WHEN** 클라이언트가 발급 후 1일 + 1초 지난 토큰으로 보호 라우트를 호출한다
- **THEN** `401 Unauthorized` 응답을 받는다

### Requirement: 부팅 시 위험 설정에 대한 자가 진단이 수행되어야 한다

서버 부팅 시 시스템은 다음을 검증해야 한다(MUST):
- `JWT_SECRET`이 알려진 기본값(`change-me-to-a-long-random-string`)인지 → 경고 출력
- `SCRAPER_ADMIN_TOKEN`이 비어 있는지 → 경고 출력
- `GOOGLE_CLIENT_ID`가 `dummy`이면서 `NODE_ENV=production`인지 → 경고 출력
- `CORS_ALLOWED_ORIGINS`가 비어 있으면서 `NODE_ENV=production`인지 → **부팅 거부**

#### Scenario: 운영 환경에서 CORS 미설정
- **WHEN** `NODE_ENV=production`이고 `CORS_ALLOWED_ORIGINS`가 비어 있다
- **THEN** 서버는 명시적 에러 메시지와 함께 비-0 exit code로 종료한다

#### Scenario: 운영 환경에서 JWT_SECRET이 기본값
- **WHEN** `NODE_ENV=production`이고 `JWT_SECRET=change-me-to-a-long-random-string`이다
- **THEN** 서버는 부팅 시 `[보안 경고]` 로그를 출력한다 (부팅 자체는 진행됨 — 기존 토큰 호환성)

