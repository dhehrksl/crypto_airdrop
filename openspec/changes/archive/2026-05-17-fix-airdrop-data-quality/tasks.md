## 1. Blocklist 모듈 + 가드

- [x] 1.1 `backend/src/config/blockedSources.js` 신규 — `{ hosts: ['airdrops.io', ...], sourceNames: [...] }` 단일 export
- [x] 1.2 `backend/src/services/scraper.js`의 `fetchRealData` 또는 ingestion 루프에 blocklist 가드 추가 (sourceName / official_link host 둘 다 확인). 차단 시 `skipped` 카운터 증가
- [x] 1.3 `backend/controllers/adminAirdropController.js`의 `adminCreateAirdrop`/`adminUpdateAirdrop`에 blocklist 검증 추가 — 매치 시 `400 { error: "blocked_source", host }` 응답
- [x] 1.4 `backend/models/Airdrop.js`에 pre-save / pre-update validator 추가 — blocklist 매치 시 `ValidationError` 던짐 (`insertMany`/raw query 우회 방어) — News 모델에도 동일 적용
- [x] 1.5 (검증) Mongoose 우회 시도 단위 테스트: `Airdrop.create({ official_link: 'https://airdrops.io/x', ... })` 가 reject되는지 확인 (10/10 통과)

## 2. AI 분류 강화 (프롬프트 + 사후 검증)

- [x] 2.1 `backend/src/services/scraper.js`의 `buildBatchPrompt` 수정 — `is_airdrop=false` negative examples 섹션에 *"after the airdrop ended / token distribution complete / post-distribution price reaction"* 패턴과 한국어 사례 1-2개 추가 (today 명시 + TEMPORAL CHECK 섹션 + 솔라나 SKR/셀레스티아 TIA 실패 사례 명시)
- [x] 2.2 `saveAiResult`에 사후 검증 분기 추가: `aiResult.is_airdrop === true` 이면서 `end_date` 파싱 결과가 현재 시각보다 1시간 이상 과거이면 `is_airdrop=false`로 덮어쓰고 News 분기로 라우팅
- [x] 2.3 (선택) 본문에 *"airdrop has ended" / "distribution complete" / "claim period closed"* 종결 키워드가 매치되고 `end_date`가 누락된 경우에도 같은 강등 처리 (`ENDED_KEYWORDS_REGEX`)
- [x] 2.4 사후 검증으로 강등된 경우 로그 출력 — `[AI post-check] demoted to News: <title> (end_date=<X>)`
- [x] 2.5 (검증) 사후 검증 단위 테스트: `end_date=과거`인 AI 응답이 News로 라우팅되는지 / `end_date=미래`는 그대로 Airdrop으로 가는지 (9/9 통과)

## 3. 만료 에어드랍 retention cron

- [x] 3.1 `backend/src/services/retention.js` 신규 — `demoteExpiredAirdrops()` 함수 export. `end_date < now`인 Airdrop을 News로 insert + Airdrop에서 delete (트랜잭션 또는 순차 처리)
- [x] 3.2 `backend/server.js`에 새 cron 등록 — `node-cron` 으로 매일 03:00 KST에 `demoteExpiredAirdrops()` 실행 (`AIRDROP_RETENTION_CRON` 환경변수로 override 가능)
- [x] 3.3 강등 함수가 보존해야 할 필드 매핑 정리(title/description/official_link/source/unique_hash/created_at). `_id`는 새로 발급되어도 OK — 단, getAirdropById는 _id 기반이라 알림 deep link는 끊긴다는 트레이드오프를 retention.js 상단 주석에 명시
- [x] 3.4 (검증) 단위 테스트: 만료된 Airdrop 1건 → 함수 호출 → News에 1건 생기고 Airdrop에서 사라지는지 (7/7 통과, 운영 DB의 만료된 솔라나 모바일 SKR 1건이 함께 강등됨 — 정상)

## 4. 일회성 마이그레이션 스크립트

- [x] 4.1 `backend/scripts/migrations/purge-blocked-sources.js` 신규 — `--dry-run`(기본) / `--apply` 플래그 파싱. Airdrop + News 양쪽에서 `official_link` host 또는 `source` 이름이 blocklist에 매치되는 레코드 카운트/삭제 (dry-run으로 Airdrop 35건 매치 확인)
- [x] 4.2 dry-run 시 매치 건수 + 샘플 5건 출력. `--apply` 시 deleted count 출력
- [x] 4.3 `backend/scripts/migrations/demote-expired-airdrops.js` 신규 — 동일하게 `--dry-run` / `--apply` 패턴. 기존 만료 Airdrop 일괄 강등용(이후엔 cron이 매일 처리)
- [x] 4.4 `backend/scripts/cleanup_misclassified.js` 확장 — placeholder description 패턴 추가 + dry-run/--apply 패턴으로 통일 (35건 매치 확인)

## 5. 실행 및 검증

- [x] 5.1 운영 DB 백업 — mongodump 미설치라 `scripts/backup_db.js` 신규 작성 후 실행 (`backups/backup-2026-05-17T07-20-34-192Z/` 에 4개 컬렉션 JSON 저장)
- [x] 5.2 코드 배포 후 `node scripts/migrations/purge-blocked-sources.js` (dry-run) → 결과 확인 (Airdrop 35건 매치)
- [x] 5.3 `node scripts/migrations/purge-blocked-sources.js --apply` 실행 — Airdrop 35건 삭제 완료
- [x] 5.4 `node scripts/dump_db.js` 로 airdrops.io 잔여 0건 확인 (Airdrop+News 모두 0건, 남은 Airdrop 2건은 RSS 출처)
- [x] 5.5 `node scripts/migrations/demote-expired-airdrops.js --apply` 로 기존 만료 항목 강등 (실행 시점 0건 — 검증 단계에서 솔라나 SKR 자동 처리 완료)
- [x] 5.6 retention 1회차 즉시 실행 — `{found:0, demoted:0, errors:0}` (만료 없음, 정상)
- [x] 5.7 신규 RSS 한 사이클 돌려서 *과거 에어드랍 후일담* 기사가 더 이상 Airdrop에 들어오지 않는지 샘플 점검 (174 items, aiCalls=1, aiSaved=1, blocked=0 — 새 항목 1건 XRP 시세 뉴스는 올바르게 News로 분류됨)

## 6. 문서화

- [x] 6.1 `backend/src/config/blockedSources.js` 상단 주석에 *왜 차단했는지(ToS 위반, 날짜)* 한 줄씩 명시
- [x] 6.2 `backend/scripts/migrations/README.md` 신규 — 마이그레이션 실행 순서와 백업 권장사항
