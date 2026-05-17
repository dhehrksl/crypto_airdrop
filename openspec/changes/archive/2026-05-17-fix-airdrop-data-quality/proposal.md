## Why

지난 출시 준비 커밋에서 ToS 위반 우려로 airdrops.io 스크래퍼 코드는 제거됐지만 DB에 이미 적재된 airdrops.io 데이터(현재 다수 항목)는 그대로 노출되고 있으며, `description`이 *"상세 참여 방법은 출처(airdrops.io) 원문에서 확인하세요"* 와 같이 외부 사이트로 직접 유도하는 placeholder 형태라 상업적 사용 의도가 더 뚜렷하게 드러나는 상태다. 동시에 RSS 출처의 AI 분류기는 *"이미 종료된 에어드랍의 후일담/시장 반응"* 기사를 활성 에어드랍으로 잘못 분류하고 `trust_score 90`을 부여해 푸시 트리거 임계값을 통과시키는 사례가 관찰된다(예: 2024-08 종료된 솔라나 모바일 SKR 에어드랍, 2023년 셀레스티아 TIA 에어드랍이 활성 상태로 등재). 출시 직전 상태에서 법적 리스크와 콘텐츠 신뢰도 문제를 동시에 정리해야 한다.

## What Changes

- **BREAKING (데이터)**: `source` 또는 `official_link`가 airdrops.io를 포함하는 모든 `Airdrop` 레코드를 일괄 삭제하는 일회성 마이그레이션 추가
- 스크래퍼/관리자 생성 경로에 **금지된 출처(blocklist) 검증** 추가 — airdrops.io 등 ToS 위반 소스의 재유입을 코드 레벨에서 차단
- AI 분류 프롬프트의 **`is_airdrop=false` 판정 규칙 강화** — "이미 분배가 끝난 토큰의 후일담/가격 반응/시장 분석" 패턴을 명시적으로 negative example로 추가하고, **`end_date`가 과거인 경우 무조건 `is_airdrop=false`** 로 후처리
- AI 응답의 **`end_date` 사후 검증**: 과거 날짜로 파싱되면 Airdrop이 아닌 News로 강등
- 만료된(end_date < now) 활성 에어드랍을 **주기적으로 자동 정리**하는 retention 로직 추가 — 현재는 controller에서 필터링만 하고 DB에는 잔존
- placeholder description(예: *"상세 참여 방법은 출처(...)에서"*)을 가진 잔여 데이터 식별 및 정리

## Capabilities

### New Capabilities
- `airdrop-ingestion`: RSS 수집 → 휴리스틱 필터 → AI 분류/번역 → `Airdrop`/`News` 저장의 파이프라인. 금지된 출처 차단, AI 분류 정확도(특히 과거 에어드랍 식별), 점수 임계값에 따른 푸시 트리거 규칙을 포함한다.
- `airdrop-retention`: DB에 저장된 `Airdrop`/`News`의 수명 관리. 뉴스 3일 보관, 만료 에어드랍 자동 정리, 금지 출처 데이터 마이그레이션·정리 정책을 포함한다.

### Modified Capabilities
<!-- 기존 spec이 없으므로 modified는 없음 -->

## Impact

**코드**
- `backend/src/services/scraper.js`: AI 프롬프트(`buildBatchPrompt`) 강화, `saveAiResult`에 end_date 사후 검증/강등 로직, 금지 출처 가드
- `backend/models/Airdrop.js`: 금지 출처 검증 (pre-save validator 또는 enum) — 선택
- `backend/controllers/adminAirdropController.js`: 금지 출처 입력 거부
- `backend/server.js`: 만료 에어드랍 정리용 cron 작업 추가
- `backend/scripts/`: airdrops.io 잔여 데이터 정리 일회성 마이그레이션 스크립트 신규(`scripts/migrations/purge-blocked-sources.js` 등)

**데이터**
- 운영 DB의 `Airdrop` 컬렉션에서 airdrops.io 출처/링크 보유 레코드 영구 삭제(되돌릴 수 없음 — 마이그레이션 실행 전 dump 권장)
- 과거 end_date를 가진 활성 에어드랍 → News로 강등 또는 삭제

**범위 밖**
- 프론트엔드 UI 변경 없음 (`airdropController.js`의 `end_date >= now` 필터가 이미 사용자 화면을 보호 중)
- 푸시 알림 인프라(EAS/FCM 설정)는 별도 change에서 다룸
