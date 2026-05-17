# airdrop-retention Specification

## Purpose
TBD - created by archiving change fix-airdrop-data-quality. Update Purpose after archive.
## Requirements
### Requirement: 금지된 출처의 잔여 데이터를 일괄 정리하는 마이그레이션이 제공되어야 한다

시스템은 기존에 적재된 차단 출처(`blockedSources`) 데이터를 영구 삭제할 수 있는 재사용 가능한 마이그레이션 스크립트를 제공해야 한다(MUST). 스크립트는 기본적으로 dry-run 모드로 동작하여(SHALL) 영향 받는 레코드 수를 출력하고, 명시적인 `--apply` 플래그가 있을 때만 실제 삭제를 수행해야 한다(MUST).

#### Scenario: dry-run 모드
- **WHEN** 운영자가 `node scripts/migrations/purge-blocked-sources.js` 를 실행한다 (플래그 없음)
- **THEN** 스크립트는 blocklist 매치 레코드 수와 샘플 5건을 출력하고, DB에는 어떤 변경도 일어나지 않는다

#### Scenario: 실제 삭제 적용
- **WHEN** 운영자가 `node scripts/migrations/purge-blocked-sources.js --apply` 를 실행한다
- **THEN** 스크립트는 `Airdrop` 컬렉션에서 blocklist 매치 항목을 영구 삭제하고, 삭제된 건수를 출력한다

#### Scenario: 같은 unique_hash가 News에도 존재
- **WHEN** blocklist 매치 `Airdrop` 항목과 동일한 `unique_hash`를 가진 `News` 항목이 함께 존재한다
- **THEN** 양쪽 컬렉션 모두에서 해당 항목이 삭제된다(차단 출처는 어떤 형태로도 잔존하지 않아야 한다)

#### Scenario: 마이그레이션 실행 후
- **WHEN** `--apply` 실행이 완료된 직후 `node scripts/dump_db.js`를 실행한다
- **THEN** `official_link`에 blocklist 호스트가 포함된 항목이 0건이고, `source` 배열에 blocklist 이름을 포함한 항목도 0건이다

### Requirement: 만료된 에어드랍은 정기적으로 활성 목록에서 제거되어야 한다

`end_date`가 현재 시각보다 과거인 `Airdrop` 항목은 매일 1회 자동으로 정리되어야 한다(MUST). 정리는 *삭제가 아니라 News로 강등*이며(SHALL), 원본 `unique_hash`/`_id`는 보존되어야 한다(MUST — 푸시 deep link 호환). 강등된 News는 기존 News retention 정책(3일)에 따라 자연 정리된다.

#### Scenario: 만료된 활성 에어드랍 자동 강등
- **WHEN** retention cron이 실행되었고 `end_date < now`인 `Airdrop` 항목이 N건 존재한다
- **THEN** N건이 `News` 컬렉션으로 이동(insert + delete)하고, 로그에 `[Retention] demoted N expired airdrops` 가 출력된다

#### Scenario: end_date가 없는 활성 에어드랍
- **WHEN** retention cron이 실행될 때 `end_date`가 `null`이거나 필드 자체가 없는 `Airdrop` 항목이 존재한다
- **THEN** 해당 항목은 강등 대상에서 제외된다(만료 여부를 판정할 수 없음)

#### Scenario: 푸시 deep link 호환
- **WHEN** 사용자가 강등 전에 받은 푸시 알림의 `data.airdropId`를 사용해 `GET /api/airdrops/:id`에 접근한다
- **THEN** `getAirdropById`가 `Airdrop`에서 못 찾으면 `News`에서 찾도록 이미 구현된 fallback이 강등된 항목을 정상 반환한다

### Requirement: News 컬렉션은 3일 보관 정책을 유지해야 한다

기존 `pruneOldNews()` 동작을 spec으로 명문화한다. 시스템은 `created_at`이 현재 시각으로부터 **3일** 이전인 모든 `News` 항목을 스크래퍼 실행 시점에 삭제해야 한다(MUST).

#### Scenario: 4일 지난 뉴스 자동 삭제
- **WHEN** `runScraper()`가 시작되고 `created_at`이 4일 전인 News 항목이 존재한다
- **THEN** `pruneOldNews()`가 호출되어 해당 항목이 삭제되고 로그에 삭제 건수가 출력된다

#### Scenario: 강등된 만료 에어드랍도 3일 후 삭제
- **WHEN** 만료로 News에 강등된 항목의 `created_at`이 3일을 넘긴다
- **THEN** 같은 retention 로직에 의해 자연 삭제된다(별도 분기 없음)

### Requirement: placeholder description 데이터를 식별/정리할 수 있어야 한다

운영 중 발견된 placeholder 패턴(예: *"상세 참여 방법은 출처(...)에서 확인하세요"*, *"휴리스틱 분석"* 마커)을 가진 데이터를 식별·정리할 수 있는 도구(스크립트 또는 마이그레이션)가 제공되어야 한다(MUST).

#### Scenario: 잔여 placeholder description 식별
- **WHEN** 운영자가 placeholder 정리 스크립트를 dry-run으로 실행한다
- **THEN** placeholder 패턴 매치 레코드 수와 샘플 목록이 출력된다

#### Scenario: 정리 실행
- **WHEN** 운영자가 정리 스크립트를 `--apply`로 실행한다
- **THEN** placeholder description을 가진 `Airdrop` 항목이 삭제되거나 News로 강등된다(스크립트가 어느 쪽인지 명시)

