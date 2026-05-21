# airdrop-ingestion Specification

## Purpose
TBD - created by archiving change fix-airdrop-data-quality. Update Purpose after archive.
## Requirements
### Requirement: 금지된 출처에서 유입된 항목은 ingestion 단계에서 거부되어야 한다

시스템은 ToS 위반 등의 사유로 차단된 출처(`blockedSources` 목록)에서 들어오는 모든 항목을 `Airdrop`/`News` 컬렉션에 저장해서는 안 된다(MUST NOT). 차단 판정은 **출처 이름(`sourceName`)** 또는 **`official_link`의 호스트네임** 중 하나라도 blocklist에 매치되면 성립한다. 차단된 항목은 통계상 `blocked` 카운터로 분리 집계되어야 한다(SHALL).

#### Scenario: blocklist에 포함된 호스트로 들어온 RSS 항목
- **WHEN** 스크래퍼가 `official_link: "https://airdrops.io/some-airdrop"` 인 항목을 가져왔고 `airdrops.io`가 blocklist에 있다
- **THEN** 해당 항목은 `Airdrop`/`News` 어느 컬렉션에도 저장되지 않고, AI 분류 호출도 발생하지 않으며, `skipped` 카운터가 1 증가한다

#### Scenario: blocklist에 포함된 sourceName으로 들어온 항목
- **WHEN** RSS 소스 정의의 `sourceName`이 blocklist에 매치된다
- **THEN** 해당 소스의 모든 항목이 ingestion 시점에 거부된다

#### Scenario: 관리자가 직접 금지 출처를 입력
- **WHEN** 관리자가 `POST /api/admin/airdrops`에 `official_link: "https://airdrops.io/..."` 를 포함한 페이로드를 보낸다
- **THEN** 컨트롤러는 `400 Bad Request`와 함께 차단 사유를 응답하고, DB에는 어떤 변경도 일어나지 않는다

#### Scenario: blocklist 우회 시도 (Mongoose 직접 호출)
- **WHEN** 어떤 코드가 `Airdrop.create()` 또는 `Airdrop.findOneAndUpdate({ upsert: true })`로 차단된 출처 데이터를 저장하려 한다
- **THEN** Mongoose pre-save / pre-update validator가 동작하여 `ValidationError`를 던지고 저장이 실패한다

### Requirement: AI 분류기는 이미 종료된 에어드랍을 활성 에어드랍으로 분류하지 않아야 한다

AI 프롬프트는 *"이미 분배가 끝난 에어드랍의 후일담, 가격 반응, 시장 분석, 과거 에어드랍 순위·요약"* 패턴이 `is_airdrop=false`임을 명시적인 negative example과 함께 지시해야 한다(MUST). AI 분류기가 이 카테고리의 기사를 `is_airdrop=true`로 분류해서는 안 된다(MUST NOT).

#### Scenario: 이미 종료된 에어드랍의 가격 반응 기사
- **WHEN** AI가 *"X token drops 23% after airdrop distribution"* 형태의 본문을 받았다
- **THEN** AI는 `is_airdrop=false`로 응답하고 해당 항목은 `News` 컬렉션에 저장된다

#### Scenario: 과거 에어드랍 순위/요약 기사
- **WHEN** AI가 *"Top airdrops of 2023"*, *"This year's biggest token distributions"* 류의 회고 기사를 받았다
- **THEN** AI는 `is_airdrop=false`로 응답하고 `News`에 저장된다

### Requirement: AI 응답의 end_date가 과거인 항목은 활성 에어드랍으로 저장되지 않아야 한다

AI 응답이 `is_airdrop=true` 이고 `end_date`가 파싱 가능한 ISO 8601 문자열일 때, 파싱된 시각이 현재 시각보다 **1시간 이상 과거**라면 시스템은 `is_airdrop=false`로 후처리하여 해당 항목을 `News`로 저장해야 한다(MUST). 이미 끝난 에어드랍의 후일담은 활성 Airdrop 컬렉션에 저장해서는 안 된다(MUST NOT).

#### Scenario: AI가 활성으로 분류했지만 end_date가 과거
- **WHEN** AI 응답이 `{ is_airdrop: true, end_date: "2024-08-20T00:00:00Z", title: "솔라나 모바일 SKR 에어드랍" }` 이고 현재 시각이 2026-05-17 이다
- **THEN** 시스템은 `News` 컬렉션에 저장하고 `Airdrop`에는 저장하지 않으며, 푸시 트리거도 발생하지 않는다

#### Scenario: end_date가 누락된 활성 분류 항목
- **WHEN** AI 응답이 `{ is_airdrop: true, end_date: null }` 이고 본문에 "airdrop has ended", "distribution complete" 같은 종결 키워드가 포함되어 있다
- **THEN** 시스템은 동일하게 `News`로 강등 저장한다

#### Scenario: end_date가 가까운 미래
- **WHEN** AI 응답이 `{ is_airdrop: true, end_date: "<현재 시각 + 30일>" }`
- **THEN** 사후 검증을 통과하여 `Airdrop`에 그대로 저장된다

### Requirement: blocklist 정의는 단일 소스(single source of truth)에서 관리되어야 한다

blocklist는 `backend/src/config/blockedSources.js`에서 export되는 단일 모듈이어야 하며(MUST), 모든 가드(스크래퍼, 관리자 컨트롤러, Mongoose validator)는 이 동일한 모듈을 import해야 한다(SHALL). 여러 곳에 blocklist 사본을 두어서는 안 된다(MUST NOT).

#### Scenario: blocklist에 새 출처를 추가
- **WHEN** `blockedSources.js`에 새 호스트를 한 줄 추가한다
- **THEN** 스크래퍼/관리자 컨트롤러/Mongoose validator 세 진입점 모두 별도 수정 없이 즉시 새 차단을 적용한다

### Requirement: 휴리스틱 분류 항목은 출처 원문 본문을 복제하지 않아야 한다

AI 검증을 거치지 않고 키워드 휴리스틱만으로 `News` 컬렉션에 저장되는 항목은, 출처 RSS의 본문·발췌(`contentSnippet`/`content`)를 변형 없이 `description`에 저장해서는 안 된다(MUST NOT). 휴리스틱 저장 항목의 `description`은 시스템이 정의한 정형 안내 문구(예: 원문 링크에서 상세 내용을 확인하라는 안내)여야 한다(MUST). 출처가 제공한 가공되지 않은 본문 텍스트는 헤드라인(`title`)과 원문 링크(`official_link`)를 제외하고 앱 화면에 노출되어서는 안 된다.

가공된 한국어 요약 `description`은 AI 분류기를 거쳐 `LEGAL SAFETY RULES`(원문 재출판 금지, 한 문장 중립 문맥)에 따라 생성된 항목에 한해 저장될 수 있다(SHALL).

#### Scenario: 휴리스틱 경로로 저장되는 일반 뉴스 항목

- **WHEN** 스크래퍼가 휴리스틱 점수가 `AI_THRESHOLD` 미만인 RSS 항목을 `News`로 저장한다
- **THEN** 저장되는 `description`은 출처 원문 발췌가 아니라 시스템 정의 정형 안내 문구이며, `title`은 출처 헤드라인, `official_link`는 원문 링크다

#### Scenario: AI 배치 실패로 휴리스틱 fallback이 동작

- **WHEN** AI 배치 호출이 실패하거나 특정 항목의 결과가 누락되어 해당 항목이 휴리스틱 경로로 fallback 저장된다
- **THEN** 그 항목의 `description` 또한 출처 원문 발췌를 포함하지 않고 정형 안내 문구로 저장된다

#### Scenario: AI 검증을 통과한 뉴스 항목

- **WHEN** AI 분류기가 `is_airdrop=false`로 판정하여 항목을 `News`로 저장한다
- **THEN** `description`은 AI가 생성한 한 문장짜리 한국어 중립 요약이며, 출처 원문을 그대로 옮긴 것이 아니다

