# 진행 보고서 및 프로젝트 아키텍처

> 최종 갱신: 2026-05-17
> 본 문서는 이 시점까지의 모든 설계 결정·코드 변경·법적 검토 결과를 종합합니다.

---

## 1. 프로젝트 개요

암호화폐 에어드랍 + 뉴스 정보 제공 모바일 앱(Expo / React Native + Node.js / Express + MongoDB). Google Play 출시 + AdMob 광고 수익 모델을 목표로 합니다.

**현재 상태**: 코드 측 법적 위험 대부분 처리 완료, 자체 큐레이션 + RSS 기반 운영 가능 상태. 외부 작업(처리방침 호스팅, 변호사 검토, 백엔드 HTTPS 등) 일부 미완.

**DB 현황 (2026-05-17 기준)**:
- Airdrop: 3개 (RSS+AI 검증된 actionable 항목)
- News: 170개 (전부 한국어로 번역됨)
- Submission: 0개 (사용자 제보 대기 자리)

---

## 2. 이번 세션의 핵심 변경 내역

### 2.1. 데이터 수집·분류 이슈 진단 및 개선
- **문제**: 뉴스 양 부족(휴리스틱 SKIP 임계값으로 158개 버려짐), 에어드랍 탭에 뉴스성 기사 혼입(이더파이/웜홀 사례)
- **수정**:
  - 휴리스틱 `SKIP_THRESHOLD: 5 → 0`
  - `NEGATIVE_PATTERNS` 축소 (lawsuit/hack/SEC/court 등 일반 뉴스 단어 제거, 광고/노이즈만 거름)
  - AI 프롬프트 강화: "참여 가능한 진행 중/예정 캠페인"만 `is_airdrop=true`
  - 과거 사건 분석·가격 변동·랭킹·추측 기사는 무조건 News
  - 이중 저장 방지 (Airdrop 저장 시 같은 unique_hash의 News 삭제 + 반대도)

### 2.2. 한국어 번역 전면 적용
- RSS 모든 항목을 AI 배치(Gemini 2.5 Flash)에 보내 분류 + 번역
- 기존 영문 News 158개를 일괄 한국어로 마이그레이션 (`scripts/dev/translate_existing_news.js`)
- 결과: News 170개 전부 한국어 제목·요약

### 2.3. 뉴스 보관 정책
- 3일 retention — `pruneOldNews()`가 매 스크래퍼 실행 시 오래된 항목 자동 삭제
- 기본 표시 limit: 뉴스 50개, 에어드랍 100개

### 2.4. 확정 에어드랍 탭 제거
- `GuaranteedAirdrop` 모델·라우트·컨트롤러·시드·프론트 화면·훅·API 함수 일체 제거
- `userController.js`에서 GuaranteedAirdrop 참조 정리
- MongoDB의 `guaranteedairdrops` 컬렉션 drop
- 탭 아이콘과 라우트도 `App.js`에서 제거

### 2.5. 뉴스 탭 UI 개선
- `NewsDetailScreen` 신규 — 뉴스 전용 깔끔한 기사 뷰 (신뢰점수·참여 버튼 없음)
- `NewsScreen` → `Detail` 대신 `NewsDetail`로 navigate

### 2.6. 캘린더 연동 개선
- 하드코딩 IP 제거, `api.js` 통일 사용
- 도트 색상 구분: 빨강(3일 내 마감) / 초록(공식 확정) / 보라(기타)
- 항목 누르면 `Detail`로 이동
- 뉴스는 자동 제외(`type=airdrops`로만 조회)

### 2.7. airdrops.io 통합 → 완전 제거 (법적 위험)
- 초기: 메인 페이지 + 디테일 페이지 스크래핑으로 진행 중 에어드랍 35~39개 수집
- 정규식으로 마감일 추가 추출 (3개 → 10개로 증가)
- **이후 ToS 검토에서 명시적 상업적 사용 금지 확인**:
  ```
  "personal, non-commercial transitory viewing only"
  "use the materials for any commercial purpose ... is prohibited"
  "transfer the materials to another person or 'mirror' the materials ... is prohibited"
  ```
- 광고 수익 모델 출시와 충돌 → **전면 제거**
  - `airdropsIoScraper.js` 파일 삭제
  - `scraper.js`에서 호출 제거
  - DB의 `source: 'airdrops.io'` 항목 35개 삭제

### 2.8. 자체 큐레이션 + 사용자 제보 시스템 구축
airdrops.io 제거를 보완하기 위한 합법적 대안:
- **`Submission` 모델**: 사용자 제보 (pending → approved/rejected)
- **사용자 제보 폼**: `SubmitAirdropScreen` — 제목/설명/링크/카테고리/체인/마감일 입력
- **관리자 화면**: `AdminScreen` — 대기 제보 검토(승인/거절) + 직접 에어드랍 입력 (탭 분리)
- **권한 모델**: `User.isAdmin` Boolean + `adminMiddleware`
- 승인된 제보는 `Airdrop` 컬렉션에 `source: ['curated']`로 게시 (`trust_score: 75`)

### 2.9. 법적 위험 대응 (8개 영역)
| 위험 | 처리 |
|---|---|
| 개인정보 처리 동의·표시 | `docs/privacy-policy.md` + 앱 내 `PolicyScreen` |
| 이용약관 | `docs/terms-of-service.md` + 앱 내 표시 |
| 회원 탈퇴·데이터 삭제 | `DELETE /api/user/account` + UserScreen 버튼 |
| 면책 문구 | `DisclaimerGate` (첫 실행) + `DetailScreen`/`NewsDetailScreen` footer |
| 푸시 광고성 표현 | "🚀 새로운 고신뢰 에어드랍!" → 중립적 문구로 변경 |
| "신뢰 점수" 투자권유 오인 | "AI 매칭도"로 라벨 변경 (DB 필드명은 trust_score 유지) |
| AdMob 정책 | 광고 영역 "광고" 라벨 표시 + `admobConfig.js` 가이드 |
| Data Safety 신고 | `docs/data-safety.md` 양식 입력 가이드 |

### 2.10. Express 5 라우팅 이슈 우회
- `routes/user.js` 내 `router.delete('/me', ...)` 등 정적 path가 라우터 stack에는 등록되나 실제 요청 매칭 실패
- 원인 추정: Express 5의 path-to-regexp v8 호환성 + 좀비 프로세스 영향
- 해결: 신규 엔드포인트는 `server.js`에 `app.method(...)`로 직접 등록
- 결과: 모든 엔드포인트가 정상 동작 (인증 없음 시 401, 인증 있음 시 200)

---

## 3. 현재 아키텍처

### 3.1. 백엔드 (`/backend`)
Node.js + Express 5 + MongoDB(Mongoose). 매시간 cron으로 스크래퍼 자동 실행.

```
backend/
├── server.js                    # 메인 — Express 부팅, 신규 라우트 직접 등록, cron 스케줄
├── config/
│   └── passport-setup.js        # Google OAuth 설정
├── controllers/
│   ├── airdropController.js     # /api/airdrops 조회 (type=airdrops/news, sort, limit)
│   ├── authController.js        # 회원가입/로그인/Google 로그인 (isAdmin 응답 포함)
│   ├── userController.js        # 참여 표시, 계정 삭제
│   ├── marketController.js      # CoinGecko 가격 프록시
│   ├── submissionController.js  # 사용자 제보 + 어드민 승인/거절
│   └── adminAirdropController.js # 어드민 직접 입력/수정/삭제
├── middleware/
│   ├── authMiddleware.js        # JWT 검증
│   └── adminMiddleware.js       # isAdmin 검증 (인증 미들웨어 다음에 사용)
├── models/
│   ├── Airdrop.js               # 에어드랍 (source, category, chain, trust_score, end_date 등)
│   ├── News.js                  # 뉴스 (3일 retention)
│   ├── User.js                  # 사용자 (isAdmin 필드 추가)
│   └── Submission.js            # 사용자 제보 (pending/approved/rejected)
├── routes/
│   ├── airdrops.js              # GET /api/airdrops, /:id
│   ├── auth.js                  # /api/auth/{register,login,google/token-signin}
│   ├── user.js                  # /api/user/airdrops/* (참여 관리)
│   └── market.js                # /api/market/price
├── src/services/
│   └── scraper.js               # RSS 17개 소스 → AI 분류·번역 → DB 저장
└── scripts/
    ├── scraper/run.js           # npm run scraper:once
    └── dev/
        ├── test_end_date_extract.js
        ├── reclassify_news_in_airdrops.js  # 오분류 cleanup
        └── translate_existing_news.js       # 영문 뉴스 일괄 번역
```

### 3.2. 프론트엔드 (`/frontend`)
Expo + React Native + Navigation v6 (Stack + BottomTabs).

```
frontend/
├── App.js                       # AuthProvider → DisclaimerGate → AppNav
├── src/
│   ├── components/
│   │   ├── DisclaimerGate.js    # 첫 실행 면책 동의 (AsyncStorage 저장)
│   │   ├── BannerAdComponent.js # 광고 영역 placeholder (AdMob SDK 연결 가이드)
│   │   └── NativeAdView.js      # 네이티브 광고 placeholder ("광고" 라벨)
│   ├── constants/
│   │   └── policies.js          # 처리방침·약관·면책 문구 텍스트
│   ├── context/
│   │   └── AuthContext.js       # JWT + userInfo (isAdmin 포함)
│   ├── hooks/
│   │   ├── useAirdrops.js
│   │   ├── useNews.js
│   │   └── useMyAirdrops.js
│   ├── screens/
│   │   ├── HomeScreen.js        # 에어드랍 목록 (카테고리 태그, 마감 임박 표시)
│   │   ├── NewsScreen.js        # 뉴스 목록 (NewsDetail로 이동)
│   │   ├── NewsDetailScreen.js  # 뉴스 전용 깔끔한 기사 뷰
│   │   ├── DetailScreen.js      # 에어드랍 디테일 ("AI 매칭도" + 면책 footer)
│   │   ├── CalendarScreen.js    # 마감일 도트 표시 (3가지 색상 구분)
│   │   ├── UserScreen.js        # 내 정보 + 제보·관리자·정책·탈퇴 메뉴
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── WebViewScreen.js
│   │   ├── SubmitAirdropScreen.js  # 사용자 제보 폼
│   │   ├── AdminScreen.js       # 관리자 — 대기 제보 검토 + 직접 입력
│   │   └── PolicyScreen.js      # 처리방침/약관 표시
│   └── services/
│       ├── api.js               # 모든 API 호출 (제보·어드민 함수 추가)
│       └── admobConfig.js       # AdMob 정책 준수 설정 헬퍼
```

---

## 4. API 엔드포인트 전체 목록

### 4.1. 공개
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 이메일 가입 |
| POST | `/api/auth/login` | 이메일 로그인 (응답에 `user.isAdmin`) |
| POST | `/api/auth/google/token-signin` | Google ID 토큰 검증 후 로그인 |
| GET | `/api/airdrops` | 에어드랍/뉴스 목록 (`type=airdrops\|news`, `sort`, `limit`) |
| GET | `/api/airdrops/:id` | 단건 조회 |
| GET | `/api/market/price?coinId=...` | CoinGecko 가격 프록시 |
| GET | `/api/scraper/status` | 스크래퍼 상태 |
| POST | `/api/scraper/run` | 스크래퍼 수동 트리거 (SCRAPER_ADMIN_TOKEN) |
| POST | `/api/users/push-token` | 푸시 토큰 등록 |

### 4.2. 사용자 인증 필요
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/user/airdrops/participated` | 내가 참여 표시한 에어드랍 |
| POST | `/api/user/airdrops/:id/participate` | 참여 표시 |
| DELETE | `/api/user/airdrops/:id/participate` | 참여 표시 해제 |
| DELETE | `/api/user/account` | **회원 탈퇴 + 데이터 삭제** |
| POST | `/api/submissions` | **에어드랍 제보** |
| GET | `/api/submissions/mine` | 내 제보 목록 |

### 4.3. 관리자 전용 (isAdmin=true)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/admin/submissions?status=pending` | 제보 검토 목록 |
| POST | `/api/admin/submissions/:id/approve` | 제보 승인 → Airdrop으로 게시 |
| POST | `/api/admin/submissions/:id/reject` | 제보 거절 |
| POST | `/api/admin/airdrops` | 어드민 직접 에어드랍 입력 |
| PUT | `/api/admin/airdrops/:id` | 수정 |
| DELETE | `/api/admin/airdrops/:id` | 삭제 |

---

## 5. 데이터 흐름

### 5.1. RSS → Airdrop / News
```
[RSS 17개 소스] → fetchRealData() (소스당 15개)
       ↓ (NEGATIVE 패턴 매칭 시 SKIP)
[AI 배치 10개씩] → Gemini 2.5 Flash → 분류 + 한국어 번역
       ↓
   is_airdrop?
   ├─ true  → Airdrop 컬렉션 (trust_score, end_date 포함)
   └─ false → News 컬렉션
       ↓ (cron 매시간)
   3일 지난 News → pruneOldNews() 자동 삭제
```

### 5.2. 사용자 제보 → 공개
```
사용자가 SubmitAirdropScreen에서 제출
       ↓ POST /api/submissions
[Submission status='pending']
       ↓ AdminScreen에서 승인
       ↓ POST /api/admin/submissions/:id/approve
[Airdrop source='curated', trust_score=75, is_confirmed=true]
       ↓ HomeScreen에 즉시 노출
```

### 5.3. 어드민 직접 입력 → 즉시 공개
```
AdminScreen "직접 추가" 탭
       ↓ POST /api/admin/airdrops
[Airdrop source='curated']
       ↓
HomeScreen / CalendarScreen에 즉시 노출
```

---

## 6. 정책/법무 문서 자산

| 파일 | 용도 |
|---|---|
| `docs/privacy-policy.md` | 한국어 처리방침 — 호스팅 후 Play Console URL로 등록 |
| `docs/terms-of-service.md` | 이용약관 |
| `docs/data-safety.md` | Play Console Data Safety 양식 입력 가이드 |
| `docs/launch-checklist.md` | 출시 전 체크리스트 (외부 작업 목록) |
| `frontend/src/constants/policies.js` | 앱 내 표시용 정책 텍스트 + 면책 문구 상수 |

---

## 7. 법적 검토 결과 요약

### 7.1. ✅ 처리된 위험
- 데이터 출처 ToS 위반 (airdrops.io 제거)
- 개인정보 동의 부재 (처리방침 + 면책 게이트)
- 데이터 삭제 권리 미보장 (회원 탈퇴 기능)
- 투자권유 오인 ("AI 매칭도", 면책 footer, 면책 게이트)
- 광고 표시 명확성 (광고 라벨)

### 7.2. ⚠️ 여전히 남은 외부 작업
1. **변호사 검토** (권장) — 가상자산 광고법, 투자권유 해석 영역
2. **처리방침 호스팅** — `docs/privacy-policy.md`의 `[출시 전 채워주세요]` 채우고 GitHub Pages 등에 공개 URL
3. **JWT_SECRET 교체** — `.env`에 운영용 강력 랜덤 문자열로
4. **SCRAPER_ADMIN_TOKEN 설정** — 외부 트리거 차단
5. **백엔드 HTTPS 배포** — 현재 HTTP라 토큰 평문 전송 위험
6. **AdMob SDK 실제 통합** — `react-native-google-mobile-ads` 설치 + 광고 단위 ID
7. **AdMob 콘솔 차단 카테고리** — 도박/암호화폐 거래소/성인
8. **Play Console Data Safety** — `docs/data-safety.md` 입력
9. **RSS 매체별 ToS 확인** — CoinDesk/CoinTelegraph 등의 한국어 번역 재게시 허용 여부
10. **사업자등록 + 통신판매업 신고 검토** — 광고 수익 발생 시 (세무사 영역)

### 7.3. 검토된 외부 데이터 소스 매트릭스
| 소스 | 무료 | 상업적 OK | 에어드랍 데이터 |
|---|---|---|---|
| airdrops.io | ⭕ | ✗ (ToS 위반) | ⭕ → 제거됨 |
| CoinGecko Demo | ⭕ 10K/월 | ✗ (비상업) | ✗ |
| CoinMarketCap Basic | ⭕ 10K/월 | △ | ✗ |
| CoinMarketCap Standard | ✗ $79/월 | ⭕ | ⭕ |
| CryptoCompare/CoinDesk | ✗ (2026-05 종료) | ✗ | ✗ |
| DefiLlama | ⭕ | ⭕ | ✗ (없음) |
| NewsData.io | ⭕ 200/일 | ⭕ | ✗ |
| RSS (현재 사용 중) | ⭕ | 매체별 | ✗ |
| **자체 큐레이션** | ⭕ | ⭕ | ⭕ (운영 필요) |

**결론**: 무료 + 상업적 OK + 에어드랍 전용 = 사실상 자체 큐레이션이 유일. 합법 모델로 채택.

---

## 8. 운영 가이드

### 8.1. 본인 계정을 어드민으로 만들기
MongoDB Shell:
```js
db.users.updateOne({ email: "본인이메일" }, { $set: { isAdmin: true } })
```
이후 로그아웃 → 재로그인 시 토큰에 isAdmin 반영, "🛠 관리자 페이지" 메뉴 노출.

### 8.2. 스크래퍼 수동 실행
```bash
cd backend
npm run scraper:once
```
또는 `POST /api/scraper/run` (SCRAPER_ADMIN_TOKEN 헤더 필요)

### 8.3. 첫 출시 직전 큐레이션 데이터 채우기
관리자 페이지 → "직접 추가" 탭에서 5~10개 항목 입력. 첫 화면이 비어 보이지 않도록.

---

## 9. 알려진 제약·이슈

- Gemini API 무료 티어: 분당 15회, 일 1500회. 초과 시 새 데이터 안 들어옴.
- 매시간 cron이 같은 항목 RSS에서 다시 fetch하지만 DB 중복은 unique_hash로 차단.
- Express 5 + path-to-regexp v8 호환성 — 일부 정적 path 라우터 매칭 실패 케이스 있음. `app.js`에 직접 등록으로 우회.
- `BannerAdComponent` / `NativeAdView`는 `react-native-google-mobile-ads` v14로 실제 통합 완료 (UMP 동의 게이트 포함). app.json의 AdMob App ID/Unit ID가 비어있거나 Expo Go 환경에서는 자동으로 placeholder fallback.
- 백엔드 HTTPS 미적용 — 운영 배포 시 reverse proxy(nginx, caddy 등) 필요.

---

## 10. 향후 작업 (출시 후 단계적)

- 푸시 알림 정밀화 (마감 임박, 신규 에어드랍 알림 토글)
- 관리자 화면에 수정/삭제 UI (현재는 입력만)
- 사용자 제보 알림 (승인/거절 결과를 제보자에게 푸시)
- 통계 대시보드 (어드민)
- 사업자등록 시점에 결제 모듈 도입 (예: 프로젝트 유료 노출, VIP 멤버십)

### 완료된 운영 항목
- **에러 트래킹 (Sentry)** — 백엔드 `@sentry/node` v9 + 프론트엔드 `@sentry/react-native` v7 통합 완료 (2026-05-19). DSN은 백엔드 `SENTRY_DSN` 환경변수 / 프론트 `app.json` `expo.extra.sentry.dsn`으로 주입. DSN 미설정 시 자동 no-op이라 개발 환경 노이즈 없음. 상세 설정 절차는 `docs/deployment-render.md` 9번 섹션 참고.
- **AdMob SDK + UMP 동의** — `react-native-google-mobile-ads` v14 통합 완료 (2026-05-19). `BannerAdComponent`(앵커 배너)와 `NativeAdView`(MEDIUM_RECTANGLE)를 4화면(Home/News/Detail/NewsDetail)에 통합. `requestConsent()`가 부팅 시 `AdsConsent.gatherConsent`로 GDPR/CCPA 동의 폼을 자동 처리하고, `useAdConsent` hook으로 광고 컴포넌트가 결과를 구독해 동의 전·거부 시 placeholder만 표시. 미동의는 NPA(non-personalized)로 폴백. 사용자가 해야 할 일은 AdMob 콘솔에서 App ID/Unit ID 발급 후 `app.json`에 입력 (`docs/launch-checklist.md` 6번 섹션 참고).
- **Jest 단위 테스트 1차 셋업** — `jest` v29 + `supertest` v7 devDependency 추가, `jest.config.js` + `__tests__/setupEnv.js`로 환경 분리, `npm test` 스크립트 추가 (2026-05-20). 1차 커버리지: `_validators.js`(email/password/username 경계값 + 거부 케이스), `errorHandler.js`(production/development 분기 + headersSent 분기 + 로그 방어선), `authMiddleware.js`(헤더 부재/형식 오류/위조 토큰/만료 토큰/정상 토큰 분기).
- **`server.js` → `app.js` 분리 + supertest 통합 테스트** (2026-05-20) — `app.js`는 미들웨어/라우트/에러핸들러만 책임지고 module.exports. `server.js`는 부팅 진입점으로 축소(dotenv → instrument → 보안 자가진단 → mongoose.connect → cron 등록 → listen). 스크래퍼 공유 상태는 `src/services/scraperRunner.js`로 분리해 HTTP 라우트와 cron이 같은 락/쿨다운을 공유. 통합 테스트는 `app.integration.test.js`에서 `/health`(helmet 헤더 포함), `/api/_debug/throw`(errorHandler dev 분기), `/api/scraper/status`, `/api/scraper/run`(admin 토큰 분기 + `runScraper` mock), 보호 라우트 401 분기, CORS dev-fallback.
- **DB 통합 테스트 (mongodb-memory-server)** (2026-05-20) — `__tests__/helpers/db.js`가 in-memory mongo를 띄우고 mongoose 연결, 테스트 사이 컬렉션 정리. rate limit는 `NODE_ENV=test`에서 skip되도록 `rateLimits.js`에 가드 추가. `auth.integration.test.js`(가입 검증 분기 + 정규화 + 중복 + 로그인 케이스 = 20 tests), `submission.integration.test.js`(인증된 제보 생성/조회 + 본인 격리 + trim = 10 tests), `admin.integration.test.js`(계정 삭제 후 재로그인 거부, 비-admin 403, admin 200, status 필터, 제보 승인 → Airdrop 생성 e2e = 7 tests). 전체 회귀: 7 suites · **85 tests · ~5.7초**.
- **GitHub Actions CI** (2026-05-20) — `.github/workflows/ci.yml`: push to main + pull_request 트리거. `backend-test` job(Node 20 + mongodb-binaries 캐시 + `npm test`) + `frontend-install` job(deps 회귀 검출). `concurrency`로 같은 PR 재실행 시 이전 워크플로 자동 취소. PR 머지 차단(required status check)은 GitHub Settings에서 사용자가 직접 설정 — 절차는 `docs/HOW_TO_RUN.md` 4번 섹션 참고.
- **Sentry 검증 스크립트** (2026-05-20) — `backend/scripts/sentry-test.js` + `npm run sentry:test`. SENTRY_DSN 환경변수를 받아 `captureMessage` + `captureException` → `Sentry.flush(5s)`로 transport ack 확인. exit code로 CI/운영 점검 가능. DSN 누락 시 명확한 fail-fast 메시지. 절차는 `docs/deployment-render.md` 9.5 섹션 참고.
- **구조화된 로깅 (pino + pino-http)** (2026-05-20) — `backend/src/lib/logger.js` 단일 인스턴스. production은 JSON 한 줄(Render Logs/CloudWatch 친화), development는 `pino-pretty`, test는 silent. `redact`로 password/token/Authorization 헤더 자동 마스킹. `pino-http`가 모든 요청을 method/url/status/responseTime 구조로 로깅(`/health`는 noise라 제외). 운영 코드의 ~80건 `console.*`을 모두 logger로 교체 — 서비스/컨트롤러/미들웨어 전부 reqId 기반 child logger를 통해 요청-스코프 로그 출력. **일회성 `scripts/**`는 의도적으로 console 유지** — 사람이 CLI에서 직접 읽는 도구라 JSON 출력이 부적절. 정책은 `backend/scripts/README.md`에 명시. 테스트 환경에서는 `LOG_LEVEL=silent`로 노이즈 0. 회귀: 7 suites · 85 tests 통과 유지.

---

## 부록 A — 변경 이력 (이번 세션)

1. 에어드랍 데이터 진단 + RSS 수량 5→15
2. airdrops.io 스크래퍼 추가 (39개 항목)
3. 디테일 페이지 정규식으로 마감일 6개 추가 추출
4. 뉴스 탭 UI 분리 (`NewsDetailScreen`)
5. 캘린더 연동 정리 (도트 색상 구분, navigation 연결)
6. 휴리스틱·AI 분류 정책 재정비
7. 4건 오분류 News로 이동 (이더파이/웜홀/옵티미즘/마크롱코인)
8. AI 프롬프트 강화 + 이중 저장 방지
9. 일반 뉴스 흡수 (NEGATIVE 축소, SKIP=0)
10. 영문 뉴스 158개 일괄 한국어 번역
11. 추가 오분류 2건 정리 (아이겐레이어 계획, 2026 초 에어드랍)
12. 8개 법적 위험 영역 코드 처리
13. airdrops.io ToS 검토 → 완전 제거 결정
14. 자체 큐레이션 + 사용자 제보 시스템 구축 (Submission 모델, 관리자 미들웨어, 어드민/제보 화면, 직접 입력)
15. Express 5 라우팅 이슈 server.js 직접 등록으로 우회
16. 좀비 프로세스 강제 종료 후 모든 신규 엔드포인트 401 검증 완료

---

## 부록 B — 기존 진행 보고서

이전 버전(`PROGRESS_REPORT.md` 초기본)은 GuaranteedAirdrop 탭, airdrops.io 의존 등 이번 세션에서 제거된 항목을 포함하고 있어 본 문서로 완전히 대체되었습니다.
