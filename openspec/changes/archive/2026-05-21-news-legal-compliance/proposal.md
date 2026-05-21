## Why

뉴스 기능이 언론사 RSS 원문(영어 헤드라인 + 본문 발췌)을 무변형으로 복제·저장해 광고가 붙은 화면에 노출하고 있어, 약관·UI 표시·AI 안전 설계가 모두 "원문을 가공/번역해 제공한다"고 진술하는 것과 모순된다. Play 출시 직전이며, 이는 저작권·표시광고법 측면의 출시 블로커다.

## What Changes

- **휴리스틱 뉴스 경로의 원문 발췌 복제 제거**: `scraper.js`의 `saveHeuristic()`이 RSS `contentSnippet`을 240자로 잘라 `description`에 무변형 저장하던 동작을 중단한다. 휴리스틱으로 분류된 뉴스는 헤드라인 + 출처 + 원문 링크 + 정형 안내 문구만 저장한다(본문 발췌 미저장). AI 검증을 거친 뉴스만 한국어 중립 요약 `description`을 갖는다.
- **UI 표시 정정**: `NewsScreen` 부제 "AI로 번역해 제공합니다"는 휴리스틱 항목에 대해 거짓이므로, 실제 동작(헤드라인 수집 + 일부 AI 요약)을 정확히 기술하는 문구로 교체한다.
- **호스팅용 법적 문서와 앱 내 문서 동기화**: `docs/terms-of-service.md`를 앱 내 `TERMS_OF_SERVICE_KO`와 일치시킨다 — 더 이상 사용하지 않는 `airdrops.io` 출처 명시 제거, 출처 목록(RSS·Telegram·Snapshot) 일치, 제3조 저작권 문구를 실제 동작(헤드라인+링크 또는 짧은 요약)과 일치시킨다.
- **법적 문서 플레이스홀더 작성**: `docs/terms-of-service.md`·`docs/privacy-policy.md`의 시행일자·문의 이메일·개인정보 보호책임자 연락처를 채우고, `policies.js`의 정책 본문 시행일자를 확정한다. 사업자 상호·관할법원 등 변호사 검토가 필요한 항목은 명시적 placeholder로 남겨 launch-checklist에 연결한다.
- **RSS 출처 라이선스 리스크 문서화**: 27개 RSS 출처 중 상업 매체와 프로젝트 공식 채널을 구분하고, 라이선스 검증 필요 항목을 `launch-checklist.md`에 사용자 결정 사항으로 정리한다.

## Capabilities

### New Capabilities

(없음 — 신규 capability를 도입하지 않는다.)

### Modified Capabilities

- `airdrop-ingestion`: 휴리스틱(AI 미검증) 경로로 분류된 항목을 `News`에 저장할 때 출처 원문 본문을 복제해서는 안 된다는 요구사항을 추가한다. AI 검증을 거친 항목만 가공된 한국어 요약 `description`을 가질 수 있다.

## Impact

- **코드**: `backend/src/services/scraper.js` (`saveHeuristic`, `NewsScreen` 부제 관련 데이터), `frontend/src/screens/NewsScreen.js`
- **데이터**: `News` 컬렉션 — 휴리스틱 저장 항목의 `description` 의미 변경(원문 발췌 → 정형 안내 문구). 기존 저장분은 3일 retention으로 자연 교체됨.
- **문서**: `docs/terms-of-service.md`, `docs/privacy-policy.md`, `docs/launch-checklist.md`, `frontend/src/constants/policies.js`
- **스펙**: `openspec/specs/airdrop-ingestion/spec.md`
- **범위 밖(사용자 결정)**: 변호사 검토, 사업자 상호·관할법원 확정, RSS 출처별 개별 라이선스 동의 여부.
