## 1. 의존성 + 환경변수

- [x] 1.1 `cd backend && npm i helmet express-rate-limit` 설치 (helmet 8.1.0, express-rate-limit 8.5.2)
- [x] 1.2 `backend/.env`에 신규 항목 추가 (NODE_ENV, CORS_ALLOWED_ORIGINS, JWT_EXPIRES_IN)
- [ ] 1.3 (운영 배포 시점에) 위 env 값을 운영 환경에 맞게 설정 — 본 change에선 default만 추가, 운영 시점에 갱신 (배포 가이드는 별도 change)

## 2. CORS 화이트리스트

- [x] 2.1 `backend/server.js`의 `app.use(cors())` → 함수형 옵션으로 교체 (CORS_ALLOWED_ORIGINS 쉼표 split)
- [x] 2.2 NODE_ENV=production + 빈 화이트리스트 → console.error + process.exit(1) — runSecuritySelfCheck로 통합
- [x] 2.3 dev 모드 빈 화이트리스트 → 모든 origin 허용 + [보안 경고] 1회 출력
- [x] 2.4 차단 시 origin을 로그로 남김(`[CORS] blocked origin: <origin>`)
- [x] 2.5 (검증) verify_security_integration.js에 통합 — dev fallback 통과 확인

## 3. helmet 적용

- [x] 3.1 helmet 등록 (contentSecurityPolicy: false, cors 전)
- [x] 3.2 (검증) X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security 헤더 확인 (3/3 통과)

## 4. rate-limit

- [x] 4.1 `backend/middleware/rateLimits.js` 신규 — authLimiter/submissionLimiter/generalLimiter
- [x] 4.2 server.js에 부착: /api/auth → authLimiter, /api/submissions POST → submissionLimiter, /api 일반 → generalLimiter (scraper/auth path 제외)
- [x] 4.3 RateLimit-* 헤더 응답 포함 확인 (express-rate-limit draft-7)
- [x] 4.4 (검증) auth 6번째 호출 → 429 확인

## 5. 입력 검증 (이메일/비밀번호)

- [x] 5.1 `backend/controllers/_validators.js` 신규 — isValidEmail, validatePassword
- [x] 5.2 authController.registerUser에 검증 추가 — invalid_email / weak_password 반환
- [x] 5.3 (검증) 잘못된 이메일/약한 비번 → 400 확인 (2/2 통과)
- [x] 5.4 `_validators.js`에 `validateUsername(s)` 추가 (3-20자, 영숫자+`_`+`-`)
- [x] 5.5 `models/User.js`의 `username`에 `unique: true` + `lowercase: true` 추가
- [x] 5.6 `authController.registerUser/loginUser`에 이메일/사용자명 정규화(trim+lowercase) — register/login 둘 다 적용 (login 정규화 누락도 같이 수정)
- [x] 5.7 `authController.registerUser`의 `save()` E11000 catch — `400 { error: "duplicate", field }`로 변환
- [x] 5.8 응답 형식 일관성 — register/login `{ error: '<code>', msg: '<한국어>' }` 통일, `res.send('Server error')` 제거, `next(err)`로 errorHandler 위임
- [x] 5.9 (검증) verify_security_integration.js에 케이스 추가 — invalid_username, 대문자 email 중복 → 14/14 통과

## 6. JWT 만료 단축 + 환경변수화

- [x] 6.1 expiresIn '7d' → process.env.JWT_EXPIRES_IN || '1d' (register/login/googleSignIn 3곳)
- [x] 6.2 (검증) 토큰 exp - iat = 86400s = 1d 정확 확인

## 7. 글로벌 에러 핸들러

- [x] 7.1 `backend/middleware/errorHandler.js` 신규
- [x] 7.2 server.js 라우트 등록 후 errorHandler 부착
- [x] 7.3 (검증) /api/_debug/throw → status 500 + Internal Server Error + dev에서 stack 포함 확인

## 8. 부팅 자가 진단

- [x] 8.1 runSecuritySelfCheck() — JWT_SECRET 약한 값, SCRAPER_ADMIN_TOKEN 빈 값, GOOGLE_CLIENT_ID=dummy(prod), CORS_ALLOWED_ORIGINS 빈 값(prod fatal)
- [x] 8.2 dotenv 로드 직후, Express 초기화 전에 호출

## 9. 통합 검증

- [x] 9.1 NODE_ENV=development 부팅 자가 진단 로그 확인 — `[보안 경고] CORS_ALLOWED_ORIGINS 미설정 ...` 정상
- [x] 9.2 NODE_ENV=production + CORS 미설정 → 부팅 실패 확인 (`[보안 치명적]` 메시지 + process.exit(1))
- [x] 9.3 verify_security_integration.js 12/12 통과
- [x] 9.4 (선택) curl 헤더 확인 — 통합 검증에서 대체됨

## 10. 문서화

- [x] 10.1 `.env`의 신규 항목에 주석 (용도/예시) — 1.2에서 작성됨
- [x] 10.2 `docs/security.md` 신규 — 미들웨어 스택, rate-limit 한도, 자가 진단 항목, 운영 배포 체크리스트
