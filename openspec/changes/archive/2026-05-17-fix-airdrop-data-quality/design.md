## Context

현재 스크래퍼 파이프라인은 다음과 같이 동작한다:

1. `backend/src/services/scraper.js`의 `runScraper()`가 RSS 17개 소스에서 항목을 수집
2. 휴리스틱 필터(`evaluateNews`)가 NEGATIVE 패턴만 거름 — 점수 차등 없음, 전 항목 AI로 흘림
3. Gemini 배치(`BATCH_SIZE=10`)가 각 항목에 `is_airdrop`/`is_scam`/번역/`trust_score`/`end_date`를 부여
4. `is_airdrop=true` → `Airdrop` 컬렉션, false → `News` 컬렉션에 저장
5. `trust_score >= 90`이면 자동 푸시 트리거(`sendPushNotifications`)
6. `airdropController.getAirdrops`에서 응답 시 `end_date >= now` 필터로 만료 항목 제외 — DB에는 잔존

`Airdrop` 모델(`backend/models/Airdrop.js`)에는 출처(`source`) 제한이 없고, airdrops.io 스크래퍼 코드는 이전 커밋(`e4517ad`)에서 제거됐지만 이미 적재된 데이터는 정리되지 않았다. 마지막 dump 기준 `Airdrop` 38건 중 다수가 `official_link: https://airdrops.io/...`이며 description이 placeholder("진행 중인 캠페인입니다. ... 상세 참여 방법은 출처(airdrops.io) 원문에서 확인하세요")로 채워져 있다.

운영 환경은 MongoDB 단일 인스턴스(`mongodb://localhost:27017/crypto_airdrop`)이며, `dotenv`로 환경변수를 주입한다. 스크래퍼는 `node-cron`으로 매시 정각 자동 실행되며 동시 실행 락 + 쿨다운(60초)으로 보호된다.

## Goals / Non-Goals

**Goals:**
- 운영 DB에서 airdrops.io 출처/링크 데이터의 흔적을 제거하고, 코드 레벨에서 재유입을 차단한다.
- AI 분류기가 *"이미 종료된 에어드랍의 후일담"* 기사를 활성으로 잘못 분류하는 비율을 의미 있게 낮춘다.
- 만료된 에어드랍(`end_date < now`)이 DB에 무한정 잔존하지 않도록 한다.
- 향후 다른 출처도 ToS 위반이 확인되면 같은 방식으로 차단·정리할 수 있는 재사용 가능한 패턴을 만든다.

**Non-Goals:**
- 푸시 알림 전송 인프라(EAS/FCM/APNs) 정비 — 별도 change에서 다룬다.
- AI 모델 교체(예: Gemini → Claude/GPT). 프롬프트와 후처리만 손본다.
- 새로운 RSS 소스 추가 또는 휴리스틱 점수 체계 재설계.
- 프론트엔드 UI 변경. 컨트롤러 필터가 이미 사용자 화면을 보호하고 있어 데이터만 정리하면 충분하다.
- 사용자 제출(`Submission`) 흐름의 출처 검증 — 현재 사용자 제출은 별도 승인 단계가 있어 본 change 범위 밖.

## Decisions

### 1. Blocklist를 어디에 둘 것인가

**결정**: 출처 blocklist는 단일 모듈(`backend/src/config/blockedSources.js`)에 두고, **(a) 스크래퍼 ingestion 직전, (b) 관리자 생성 컨트롤러, (c) Mongoose pre-save validator** 세 곳에서 모두 참조한다.

**대안**:
- Mongoose validator 한 곳만 — 우회 가능(예: `insertMany`, `bulkWrite`, raw query). 또한 검증 실패가 런타임 에러로 표출되어 스크래퍼 통계가 흐트러진다.
- 스크래퍼만 가드 — 관리자 입력에서 누락 가능.

**근거**: defense-in-depth. blocklist 자체는 작은 배열이므로 중복 참조 비용이 거의 없고, 한 곳이라도 막히지 않으면 *"법적 위험 코드는 지웠는데 데이터는 들어왔다"* 가 재발한다.

### 2. 잔여 데이터 정리는 일회성 스크립트인가, 재사용 가능한 마이그레이션인가

**결정**: `backend/scripts/migrations/purge-blocked-sources.js`로 두고, blocklist를 인자로 받아 어떤 출처든 동일 로직으로 삭제할 수 있게 한다. 실행 시 `--dry-run` 플래그를 지원하여 영향 받는 레코드 수를 먼저 출력한다.

**대안**:
- 일회성 ad-hoc 스크립트 — 향후 다른 출처가 차단되면 비슷한 코드를 다시 써야 함.
- DB 마이그레이션 도구(예: `migrate-mongo`) 도입 — 현재 프로젝트는 마이그레이션 도구가 없어 도구 도입 비용이 본 change 가치보다 큼.

**근거**: 가벼운 자체 스크립트로 재사용성을 확보. 본 프로젝트의 기존 `scripts/cleanup_misclassified.js` 패턴(스크립트 + dotenv + 명시적 종료)을 따른다.

### 3. AI 분류 정확도를 어떻게 끌어올릴 것인가

**결정**: **프롬프트 강화 + 사후 검증** 이중 방어.
- 프롬프트: `is_airdrop=false`로 만들어야 할 *"after the airdrop ended"* 패턴 negative example을 더 명확히 추가(실제 분류 실패 사례인 솔라나 모바일 SKR, 셀레스티아 TIA 등을 참고하여 일반화된 예시 제시).
- 사후 검증: `saveAiResult`에서 `aiResult.end_date`를 파싱한 결과가 *지금보다 과거*면 강제로 `is_airdrop=false`로 덮어쓰고 News로 저장. 또한 `aiResult.is_airdrop=true`인데 `end_date`가 없고 본문에 *"airdrop ended"/"distribution complete"* 같은 종결 키워드가 있으면 같은 처리.

**대안**:
- 프롬프트만 강화 — AI는 비결정적이고, 같은 실패 패턴이 다른 형태로 반복될 수 있음. 사후 검증이 안전망 역할.
- 사후 검증만 — 프롬프트가 약하면 검증을 통과하는 false positive가 늘어 검증 로직만 복잡해짐.

**근거**: 분류 정확도는 *프롬프트 품질 × 안전망*의 곱이다. 둘 다 강화하는 게 비용 대비 효과가 가장 크다.

### 4. 만료된 에어드랍을 어떻게 처리할 것인가

**결정**: `end_date < now`인 `Airdrop` 항목은 **별도 cron으로 매일 1회** 정리하되, **삭제가 아니라 News로 강등**한다(원본 unique_hash 보존, 제목과 description은 유지).

**대안**:
- 즉시 삭제 — 사용자가 받은 푸시의 deep link가 끊김. 또한 자체 제출/큐레이션 에어드랍의 이력이 사라짐.
- 별도 archived 플래그 추가 — 조회 쿼리 전체에 `archived: false` 필터를 추가해야 해 마이그레이션 비용이 큼.
- 스크래퍼 실행 시마다 정리 — 매시 실행이라 부하 의미 없지만 의도가 흐림. 분리된 retention job이 가독성·관측성 모두 낫다.

**근거**: News로 강등하면 사용자는 *"이미 끝난 에어드랍의 후일담"* 이라는 자연스러운 흐름으로 만나게 되고, 데이터 손실 없이 활성 목록에서만 제거된다. 기존 News 3일 보관 정책에 의해 결국 정리되므로 무한 누적도 막힌다.

### 5. blocklist 위반 데이터를 발견했을 때 무엇을 할 것인가

**결정**: **삭제**한다(News로 강등하지 않음). 강등하면 description의 *"출처(airdrops.io) 원문에서 확인하세요"* 같은 본문이 News에 그대로 남아 같은 법적 리스크가 이어진다.

**근거**: blocklist는 *"이 출처와는 어떤 형태로도 연결되면 안 됨"* 을 표현한다. 부분 보존은 의도에 반한다.

## Risks / Trade-offs

- **[Risk] purge 스크립트의 영향 범위가 크다(다수 항목 일괄 삭제)** → `--dry-run` 디폴트, `--apply` 명시 시에만 실행. 실행 전 `mongodump` 권장 메시지 출력. 운영 적용 시 백업 후 적용.
- **[Risk] AI 사후 검증이 정상 활성 에어드랍을 잘못 강등할 수 있다** → end_date가 "정확히 지금 이전"이 아니라 "현재 시각보다 명백히 과거(예: 1시간 이상 전)"인 경우만 강등. 또한 강등은 News로의 보존이므로 false positive의 비용이 비교적 낮다.
- **[Risk] blocklist를 세 곳에서 참조하면 한 곳을 빼먹는다** → 단일 모듈 export + 모든 진입점에서 import. 단위 테스트로 각 진입점이 같은 모듈을 참조하는지 확인.
- **[Trade-off] 만료된 에어드랍을 News로 강등하면 News 화면에 "이미 끝난 에어드랍" 항목이 늘어난다** → News는 3일 보관이라 자연 소멸하고, 사용자가 받은 푸시의 deep link도 만료 직후 유효(같은 _id로 접근). 수용 가능한 비용.

## Migration Plan

1. **Pre-deploy**: `mongodump` 로 운영 DB 스냅샷.
2. 코드 배포(blocklist 가드 + AI 사후 검증 + 만료 cron). 신규 ingestion부터 차단·강등이 적용된다.
3. `node scripts/migrations/purge-blocked-sources.js --dry-run` 실행 → 영향 받는 레코드 수 확인.
4. 결과가 예상 범위 내면 `--apply` 로 재실행. 그 결과를 로그로 남긴다.
5. `node scripts/dump_db.js` 로 잔여 airdrops.io 데이터가 0건인지 확인.
6. (선택) `node scripts/migrations/demote-expired-airdrops.js --dry-run` → `--apply` 로 과거 end_date 항목 일괄 강등(이후엔 cron이 매일 처리).

**Rollback**: `mongodump` 스냅샷에서 복구. 신규 ingestion에는 코드 가드가 이미 들어가 있으므로 롤백 후에도 airdrops.io 데이터가 들어오지 않는다(코드 가드는 유지).
