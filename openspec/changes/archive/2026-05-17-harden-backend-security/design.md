## Context

현재 백엔드는 Express 5 + Mongoose 8 + JWT 인증으로 구성되어 있고, baseline 보안은 PoC 수준이다. `server.js:18`은 `app.use(cors())` 한 줄로 모든 origin을 허용하고, helmet/rate-limit 의존성은 `backend/package.json`에 없으며, 에러는 라우트별 try/catch에서 `console.error` 후 generic 메시지를 응답한다(글로벌 핸들러 없음). 인증은 `authController.js`에서 bcrypt 해시 + JWT `expiresIn: '7d'`로 발급한다.

운영 환경은 곧 클라우드(미정) + 단일 인스턴스로 시작 예정이라, 메모리 기반 rate-limit store로 충분하다. 분산 환경 전환은 별도 change에서 다룬다. 사용자 베이스는 출시 시점 0명이라 JWT 만료 단축으로 인한 재로그인 부담은 무시 가능하다.

`backend/middleware/`에는 이미 `authMiddleware.js`, `adminMiddleware.js`가 있어 같은 위치에 보안 미들웨어를 두는 게 일관성 있다.

## Goals / Non-Goals

**Goals:**
- 외부 노출 가능한 baseline 보안 (CORS 화이트리스트, 표준 보안 헤더, rate-limit, 입력 검증, 에러 응답 일반화) 달성
- 보안 정책을 코드(미들웨어)에 표준화해 라우트 추가 시 자동 적용
- 운영 환경(`NODE_ENV=production`)과 개발 환경의 정책 차이를 명시적으로 분기
- 부팅 시 *"위험 설정 검증"* 자가 진단으로 다음 사람이 잘못 배포할 확률 ↓

**Non-Goals:**
- WAF / DDoS / Cloudflare 같은 인프라급 방어 (호스팅 결정 이후)
- 2FA / OAuth provider 추가 / SAML
- CSRF protection (현재 SPA + JWT라 stateless, CSRF surface 작음)
- 비밀번호 사전 차단(haveibeenpwned 같은 외부 의존)
- 보안 모니터링 / 로그 집계 (별도 운영 change)

## Decisions

### 1. CORS 정책

**결정**: `CORS_ALLOWED_ORIGINS` 환경변수에서 쉼표 구분 origin을 읽음. 빈 값 또는 미설정 시:
- `NODE_ENV=production`이면 부팅 **실패**(명시적 거부 — 잘못된 배포 차단)
- 그 외(dev/test)에서는 fallback으로 모든 origin 허용 + 보안 경고 로그

**대안**:
- 항상 `*` fallback — 운영에서 사고 확률 높음
- 코드에 하드코딩 — 환경별 도메인 다른데 재배포 필요
- 별도 config 파일 — env 한 줄이면 충분, 파일 추가는 과한 분리

**근거**: env 단일 truth source + 운영에서 명시적 fail-fast로 *"실수로 별의 별 도메인이 우리 API 호출"* 시나리오를 컴파일 타임에 차단.

### 2. helmet 옵션

**결정**: `helmet()` 디폴트 사용. CSP는 `false`로 비활성(API only 응답이라 의미 없고, 잘못 설정 시 클라이언트 깨짐 위험).

**대안**: CSP까지 커스텀 — 정적 자산 서빙 없음(프론트는 Expo 별도)이라 가치 낮음.

**근거**: 디폴트만으로 X-Frame-Options/X-Content-Type-Options/Strict-Transport-Security 등 핵심 헤더 다 적용. 추가 튜닝은 필요 시점에.

### 3. rate-limit 한도 설정

**결정** (`express-rate-limit` 메모리 store):

| 그룹 | 한도 | 윈도우 | 이유 |
|------|------|--------|------|
| `/api/auth/*` (login, register) | 5 | 15분 | 브루트포스 방어. 정상 사용자는 그 안에 다 끝남 |
| `/api/submissions` (제보) | 10 | 1시간 | 스팸 방어. 정상 사용자는 시간당 10건 안 만듬 |
| 그 외 read 라우트 | 100 | 15분 | DoS 완화 + 정상 사용 보장 |

스크래퍼(`/api/scraper/run`)는 기존 토큰+쿨다운(30분)이 이미 적용 — 중복 적용 안 함.

**대안**:
- Redis 기반 store — 분산 환경 시 필요. 현재 단일 인스턴스라 과함.
- 모든 라우트에 동일 한도 — auth 같은 민감 영역엔 너무 관대

**근거**: 라우트 위험도별 차등이 사용자 마찰 최소화 + 공격 표면 최대 방어.

### 4. 입력 검증 라이브러리 선택

**결정**: 라이브러리 없이 컨트롤러에서 직접 정규식+길이 검증. 검증 로직은 `controllers/_validators.js` 같은 헬퍼로 분리 — 향후 다른 라우트에서 재사용 가능.

**대안**:
- `express-validator` — 의존성 크고 현재 검증 케이스(2-3개) 대비 과함
- `zod` / `joi` — 스키마 기반 매력적이지만 코드 스타일 큰 변화 → 별도 change에서

**근거**: YAGNI. 현재 필요는 이메일 형식 + 비밀번호 강도 두 가지만. 직접 정규식이 가장 가볍고 명시적.

### 5. 에러 핸들러 응답 형식

**결정**: `{ error: 'Internal Server Error', code?: '<machine_code>' }` 형식. dev에서는 `stack` 필드 추가, production에서는 생략. 내부 로깅(`console.error`)은 항상.

**대안**:
- 에러 코드 체계 도입(error class hierarchy) — 과한 추상화, 라우트 수 적음
- Sentry 연동 — 좋지만 별도 change

**근거**: 운영 응답에서 내부 정보 노출 0 + dev 디버깅 가능.

### 6. JWT 만료 시간

**결정**: 기본 1일(`24h`). `JWT_EXPIRES_IN` 환경변수로 override 가능. refresh token은 본 change에서 도입 안 함.

**대안**:
- 짧게(1시간) + refresh token — 사용자 베이스 작아 복잡성 비용이 가치보다 큼
- 7일 유지 — 출시 시 노출 면적 길게 가져갈 이유 없음

**근거**: 1일은 사용자 마찰(매일 1회 재로그인)과 탈취 노출 시간의 균형점. refresh token은 사용자/트래픽 늘면 별도 change.

### 7. 부팅 자가 진단

**결정**: `server.js` 부팅 시 다음 검증 + 1줄 경고 출력:
- `JWT_SECRET`이 알려진 기본값(`change-me-to-a-long-random-string`)이면 경고
- `CORS_ALLOWED_ORIGINS` 미설정 + `NODE_ENV=production`이면 **부팅 실패**
- `GOOGLE_CLIENT_ID=dummy` + `NODE_ENV=production`이면 경고
- `SCRAPER_ADMIN_TOKEN` 미설정이면 경고 (기존 로그 유지)

**근거**: 잘못된 배포를 부팅 시점에 잡는 게 가장 저렴. 운영에서 발견하면 비용 큼.

## Risks / Trade-offs

- **[Risk] CORS 화이트리스트 누락으로 정상 트래픽 차단** → 부팅 자가 진단 + 명확한 에러 로그(`[CORS] blocked origin: X`)로 빠른 진단. dev fallback은 `*` 허용으로 개발 마찰 0.
- **[Risk] rate-limit이 동일 NAT 사용자들 묶어 차단** → 한도를 너그럽게 (auth 5/15min은 정상 사용자 한참 여유). 분산 환경 전환 시 키 derivation 재검토.
- **[Risk] 비밀번호 강도 정책으로 기존(테스트) 사용자 잠금** → 사용자 1명만 있고 이미 회원이라 영향 없음. 신규 가입에만 적용.
- **[Trade-off] CSP 비활성화** → API only라 표면 작음. 정적 자산 추가 시 재검토.
- **[Trade-off] helmet 디폴트 사용 → 일부 헤더가 SPA에 영향** → 프론트는 React Native라 브라우저 헤더 영향 없음. 웹 빌드 도입 시 재검토.
- **[Risk] JWT 만료 단축으로 모바일 사용자 로그인 자주 묻기** → 사용자 0명 시점에 도입해 학습 비용 0. AsyncStorage refresh 흐름은 별도 change.

## Migration Plan

1. 패키지 설치: `cd backend && npm i helmet express-rate-limit`
2. `.env`에 `CORS_ALLOWED_ORIGINS`, `JWT_EXPIRES_IN`, `NODE_ENV` 항목 추가 (기본값 안내 주석 포함)
3. 코드 변경 적용 (미들웨어 + 검증 + 에러 핸들러 + 자가 진단)
4. 로컬에서 부팅 확인: 자가 진단 로그가 의도대로 나오는지
5. 검증 시나리오 실행:
   - 화이트리스트 외 origin에서 호출 → 차단 확인
   - 로그인 6회 연속 → 429 확인
   - 짧은 비밀번호로 register → 400 확인
   - JWT 만료된 토큰으로 보호 라우트 → 401 확인
   - 의도 에러 발생 → 응답에 스택 없음 확인 (NODE_ENV=production)
6. 운영 배포 시 `NODE_ENV=production` + `CORS_ALLOWED_ORIGINS=https://...` 설정

**Rollback**: 미들웨어 등록 라인 주석 처리 + .env에서 NODE_ENV를 dev로 되돌리면 모든 정책이 관대 모드로 회귀. 의존성은 그대로 둬도 무해.
