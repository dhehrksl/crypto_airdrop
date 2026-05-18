# Play Store 출시 체크리스트

## ⚠️ 출시 전 반드시 사용자가 해야 할 작업

### 1. 법무 검토 (필수)
- [ ] 한국 IT/스타트업 전문 변호사에게 약관/처리방침/면책 문구 검토 의뢰
- [ ] 비용 50~150만원 수준
- [ ] 특히 다음 사항을 검토받을 것:
  - 가상자산이용자보호법(2024-08 시행) 적용 여부
  - 자본시장법상 "투자 자문/투자권유" 해당 여부
  - 「표시·광고의 공정화에 관한 법률」 위반 위험 (AI 매칭도 표기)

### 2. airdrops.io 데이터 사용 라이선스
- [ ] airdrops.io 운영팀(contact 페이지 또는 이메일)에 다음 사항을 문의
  - 한국어 앱에서 제목·카테고리·마감일·원문 링크를 표시 (자체 설명 텍스트는 표시 안 함)
  - 사용자가 카드를 누르면 airdrops.io 원문 페이지로 이동
  - 광고 수익 모델 (AdMob)
- [ ] 가능하면 서면(이메일)으로 사용 허락 받기
- [ ] 또는 동일 정보를 자체 수집·가공하는 방향으로 전환

### 3. RSS 매체 라이선스 (선택)
- [ ] CoinDesk, Cointelegraph 등 주요 매체의 RSS 라이선스 약관 재확인
- [ ] 한국어 번역 + 헤드라인 + 원문 링크 형태가 fair use 범위인지 검토
- [ ] 위험 회피하려면 출처별 약관 동의 또는 헤드라인+링크만 표시 모드 고려

### 4. 개인정보처리방침 호스팅
- [ ] `docs/privacy-policy.md`의 `[출시 전 채워주세요]` 부분을 모두 채움 (사업자명, 이메일, 보호책임자 등)
- [ ] GitHub Pages / Notion / Vercel 등에 공개 URL로 호스팅
- [ ] `frontend/src/constants/policies.js` 의 `PRIVACY_POLICY_URL`, `TERMS_URL`에 URL 기입
- [ ] Play Console "앱 콘텐츠 > 개인정보처리방침" 에 URL 등록

### 5. Play Console 설정
- [ ] **데이터 보안(Data Safety)** 양식 입력 — `docs/data-safety.md` 참고
- [ ] **콘텐츠 등급(Content Rating)** 설문 작성 — 암호화폐 정보 제공 앱 / 13세 이상
- [ ] **대상 사용자(Target audience)** — 13세 이상 일반
- [ ] **광고 포함 여부** — "예" 표시
- [ ] **앱 카테고리** — 금융 또는 뉴스 및 잡지
- [ ] **스크린샷 / 아이콘 / 그래픽 이미지** 준비
- [ ] **앱 설명** — "정보 제공 목적", "투자 권유 아님" 명시
- [ ] **연락처 이메일** — 응답 가능한 주소

### 6. AdMob 콘솔 설정
- [ ] AdMob 계정 생성 후 광고 단위 ID 발급
- [ ] **차단된 카테고리** 에서 다음을 차단
  - 도박
  - 가상자산 거래소(한국 지역 규제)
  - 성인 (HG_NOT_FAMILY_SAFE)
- [ ] **앱-광고 정책** > 자녀 대상 아님 체크
- [ ] **UMP (User Messaging Platform)** 또는 자체 EU/한국 동의 UI 구현 (GDPR/PIPL 준수)

### 7. 백엔드 운영 준비
- [ ] HTTPS 도메인 + TLS 인증서 (Let's Encrypt 등)
- [ ] `JWT_SECRET` 을 강력한 랜덤 문자열로 변경
- [ ] `SCRAPER_ADMIN_TOKEN` 설정 (외부 트리거 차단)
- [ ] MongoDB 백업 정책 수립
- [ ] 에러 모니터링 (Sentry 등) 도입 권장

### 8. 변호사 검토 후 추가로 점검
- [ ] "AI 매칭도" 라벨에 면책 툴팁 추가 권장 여부
- [ ] "참여한 에어드랍" 기능을 거래 권유로 해석할 여지가 있는지
- [ ] 푸시 알림 빈도/문구가 광고법 위반 가능성이 있는지

---

## 코드로 처리된 것 (이미 적용됨)

- [x] airdrops.io 자체 설명 제거 — 헤드라인+카테고리+마감일+원문 링크만
- [x] 개인정보처리방침/이용약관 마크다운 작성 + 앱 내 PolicyScreen 표시
- [x] 회원 탈퇴 API + UI (`DELETE /api/user/me`)
- [x] 첫 실행 시 면책 동의 게이트 (DisclaimerGate)
- [x] 디테일/뉴스 화면 하단 면책 박스
- [x] 푸시 알림 문구에서 "고신뢰" 등 광고성 표현 제거
- [x] "신뢰 점수" → "AI 매칭도" 라벨 변경
- [x] 광고 영역에 "광고" 라벨 표시 (광고법 준수)
- [x] AdMob 정책 준수 설정 헬퍼 (`admobConfig.js`)
- [x] News 컬렉션 3일 자동 retention
- [x] app.json `name`/`slug`/`android.package`/`versionCode`/`bundleIdentifier` 채움 (2026-05-19 갱신)
- [x] `/api/users/push-token`·`/api/notifications/test` 인증 보강 (2026-05-19)
- [x] `JWT_SECRET` fallback 제거 — 모듈 로드 시 throw 강제
- [x] 부팅 자가 진단 강화 — production에서 `JWT_SECRET`/`MONGODB_URI`/`SCRAPER_ADMIN_TOKEN` 누락 시 부팅 거부
- [x] 백엔드 불필요한 expo-* dependencies 제거 (`expo-server-sdk`만 유지)
- [x] policies.js / docs/*.md의 `[앱 이름]` placeholder → "크립토 에어드랍"

## 코드 외부 결정 사항

- 정확한 사업자 정보(이름·연락처·관할법원)는 변호사 검토 후 사용자가 직접 기입
- 출시 후 사용자 피드백 모니터링 및 대응 절차 마련
