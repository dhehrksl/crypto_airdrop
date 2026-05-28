# 크립토 에어드랍

파편화된 가상화폐 에어드랍 정보를 자동 수집하고, AI로 스캠을 거른 뒤 한국어로 정제된 캠페인만 보여주는 모바일 앱.

- **모바일 앱**: React Native (Expo)
- **백엔드**: Node.js + Express + MongoDB
- **AI 큐레이션**: Google Gemini (multi-model fallback)
- **배포 타깃**: Google Play Store (한국)

---

## 주요 기능

- **자동 수집 파이프라인** — 27개 공식 출처(프로젝트 블로그/거버넌스 포럼/Medium publication)에서 RSS 수집 → 휴리스틱 사전 필터 → Gemini 배치 분류 → DB 저장. 매시 정각 cron.
- **공식 출처 자동 신뢰** — 화이트리스트 도메인 매칭으로 AI hallucination에 흔들리지 않음.
- **회고/가격분석 기사 차단** — `RETROSPECTIVE_TITLE_REGEX`, `POST_EVENT_TITLE_REGEX`로 "끝난 에어드랍 가격 분석" 기사 제외.
- **트래킹 툴킷** — 사용자별 워치리스트, 참여 단계, 마감 D-3/D-1/당일 푸시 리마인더.
- **관리자 큐레이션 큐** — Reddit/Telegram에서 수집한 후보를 AI 구조 추출 → 관리자 승인 후 노출.

---

## 디렉토리 구조

```
backend/         Node.js 백엔드 (Express + MongoDB)
  src/services/  scraper, geminiClient, draftExtractor, retention, reminders
  controllers/   auth, airdrops, admin, tracking, users
  models/        User, Airdrop, AirdropDraft, AirdropTracking, Submission
  scripts/       scraper:once, draft 수집, migrations, dev 검증
  __tests__/     Jest 단위/통합 테스트

frontend/        Expo (React Native)
  src/screens/   에어드랍 피드, 상세, 트래킹, 로그인/회원가입, 내정보
  src/context/   AuthContext (이메일 로그인만)
  src/services/  api (axios 클라이언트)
  src/constants/ theme, policies (개인정보처리방침/이용약관 inline)

docs/            출시·운영 문서 (아래 링크)
openspec/        spec-driven 변경 워크플로
render.yaml      Render 배포 매니페스트
```

---

## 빠른 시작 (로컬 개발)

상세 절차는 [`docs/HOW_TO_RUN.md`](docs/HOW_TO_RUN.md) 참고.

```bash
# 백엔드
cd backend
npm install
cp .env.example .env       # GEMINI_API_KEY, JWT_SECRET 채우기
npm start                  # 포트 3000, cron 자동 등록

# 스크래퍼 1회 수동 실행
npm run scraper:once

# 테스트
npm test                   # Jest
node scripts/dev/verify_ai_post_check.js   # 가드 회귀 테스트
```

```bash
# 프론트엔드 (다른 터미널)
cd frontend
npm install
npx expo start             # QR을 Expo Go로 스캔
```

폰 실기기 테스트 시 `frontend/app.json`의 `extra.backendUrl`을 로컬 LAN IP로 맞춰야 함.

---

## 운영 (Render + MongoDB Atlas)

- 배포 절차: [`docs/deployment-render.md`](docs/deployment-render.md)
- Render free 플랜 + UptimeRobot으로 sleep 방지
- cron 동작 확인: [`docs/render-cron-verification.md`](docs/render-cron-verification.md)

### Gemini 무료 한도 운영
한 모델의 일일 한도 도달 시 다음 모델로 자동 fallback. 기본 순서는 `geminiClient.js`의 `DEFAULT_MODELS` 참고. `GEMINI_MODELS` env로 override 가능.

---

## Play Store 출시

체크리스트: [`docs/launch-checklist.md`](docs/launch-checklist.md)

### Critical path
1. **법무 검토** (변호사, 약 2주 · 50~150만원)
2. **개인정보처리방침 공개 URL 호스팅** — Play Console 필수 요구. 가이드: [`docs/policy-hosting-guide.md`](docs/policy-hosting-guide.md)
3. **MongoDB Atlas** 클러스터 생성 → Render 연결
4. **EAS Build** (Android AAB) → Play Console 업로드
5. **AdMob 실 광고 단위 ID** 발급 → `frontend/app.json`에 주입

### 정책 문서
- [`docs/privacy-policy.md`](docs/privacy-policy.md) — 개인정보처리방침 (호스팅용)
- [`docs/terms-of-service.md`](docs/terms-of-service.md) — 이용약관 (호스팅용)
- [`docs/data-safety.md`](docs/data-safety.md) — Play Console "데이터 안전" 양식 답변
- 앱 내 표시본은 `frontend/src/constants/policies.js`에 inline (시행일자: 2026-05-29)

---

## 수집 개인정보 (최소)

| 항목 | 시점 | 용도 |
|---|---|---|
| username | 회원가입 | 식별 |
| email | 회원가입 | 식별/로그인 |
| password (bcrypt 해시) | 회원가입 | 인증 |
| Expo Push Token | 푸시 옵트인 | 알림 발송 |
| 광고 ID (AAID) | 자동 | AdMob 광고 빈도 제어 |

실명·생년월일·연락처·결제정보 — **수집하지 않음**. 자세한 처리방침은 위 정책 문서 링크 참고.

---

## 보안

- `docs/security.md` — JWT/CORS/rate limit/입력 검증/secrets 관리
- 부팅 시 자가진단 (`server.js`): production에서 약한 `JWT_SECRET`, 미설정 `CORS_ALLOWED_ORIGINS`, `SCRAPER_ADMIN_TOKEN` 부재 시 fail-fast

---

## 라이선스

비공개 (개인 운영). 출시 후 라이선스 정책 결정 예정.
