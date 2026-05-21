## 1. 휴리스틱 뉴스 경로 — 원문 발췌 복제 제거

- [x] 1.1 `backend/src/services/scraper.js`의 `saveHeuristic()`에서 `snippet`(잘린 원문 발췌)을 `description`에 넣는 로직을 제거하고, 항상 정형 안내 문구를 `description`으로 저장하도록 수정
- [x] 1.2 `title`은 출처 헤드라인, `official_link`는 원문 링크, `source`는 출처명을 그대로 유지하는지 확인
- [x] 1.3 AI 배치 실패/누락 fallback도 동일한 `saveHeuristic()`을 거치므로 fallback 항목 역시 원문 발췌가 없는지 확인

## 2. UI 표시 정정

- [x] 2.1 `frontend/src/screens/NewsScreen.js`의 부제 "AI로 번역해 제공합니다"를 실제 동작(헤드라인 수집 + 일부 AI 요약, 상세는 원문 확인)을 반영한 문구로 교체
- [x] 2.2 `NewsDetailScreen`의 본문/면책 표시가 정형 안내 문구와 자연스럽게 어울리는지 확인

## 3. 법적 문서 동기화

- [x] 3.1 `docs/terms-of-service.md`에서 `airdrops.io` 명시(제2조·제3조)를 제거하고 출처 목록을 앱 내 `TERMS_OF_SERVICE_KO`(RSS·Telegram·Snapshot·제보)와 일치시킴
- [x] 3.2 `docs/terms-of-service.md` 제3조 저작권 문구를 실제 동작("헤드라인과 짧은 문맥 요약, 원문 링크만 제공")으로 정정
- [x] 3.3 `docs/privacy-policy.md` 7항의 HTTPS 문구에서 `[출시 시 적용]` 표식을 제거하고 단정형으로 정리 (Render가 HTTPS 제공)

## 4. 법적 문서 placeholder 작성

- [x] 4.1 `docs/terms-of-service.md`·`docs/privacy-policy.md`의 시행일자 placeholder를 출시 예정 기준 날짜로 채움
- [x] 4.2 두 문서의 문의 이메일·개인정보 보호책임자 연락처를 운영자 이메일(`kimminsu4906@gmail.com`)로 채움
- [x] 4.3 `frontend/src/constants/policies.js`의 `PRIVACY_POLICY_KO`·`TERMS_OF_SERVICE_KO` 본문 시행일자를 확정 날짜로 교체
- [x] 4.4 사업자 상호·관할법원·보호책임자 실명 등 변호사 검토 필요 항목은 `[변호사 검토 후 기입]` 형태의 명확한 표식으로 남김

## 5. RSS 출처 라이선스 리스크 정리

- [x] 5.1 `docs/launch-checklist.md`에서 `airdrops.io` 관련 항목(2번)을 "제거 완료"로 정리하고, RSS 출처 검증(3번)을 상업 매체 vs 프로젝트 공식 채널 구분과 함께 구체화
- [x] 5.2 호스팅 정책 URL 미등록(`PRIVACY_POLICY_URL`/`TERMS_URL`)을 launch-checklist에 출시 블로커로 명확히 표기

## 6. 검증

- [x] 6.1 `backend` 테스트 실행 (`npm test`) — 스크래퍼 관련 테스트가 정형 `description` 기준으로 통과하는지 확인, 필요 시 테스트 갱신
- [x] 6.2 `evaluateNews`/`saveHeuristic` 동작을 시뮬레이션 스크립트나 단위 테스트로 확인해 휴리스틱 항목 `description`에 원문 발췌가 없음을 검증
- [x] 6.3 `openspec validate news-legal-compliance`로 스펙 정합성 확인
