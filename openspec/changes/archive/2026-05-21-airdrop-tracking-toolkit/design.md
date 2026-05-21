## Context

현재 사용자-에어드랍 관계는 `Airdrop.participatedBy: [ObjectId<User>]` 하나뿐이다. 워치리스트, 단계별 진행, 리마인더 발송 이력은 모두 (사용자, 에어드랍) 단위 사실이지만 저장할 곳이 없다.

기존 인프라:
- **푸시**: `scraper.js`의 `sendPushNotifications()`가 Expo SDK로 발송하는 패턴이 있다. `User.push_token`은 로그인 시 `HomeScreen`에서 등록된다.
- **cron**: `server.js`가 `node-cron`으로 scraper/draft/retention 3개 작업을 등록한다. 각 작업은 `*_CRON_ENABLED` / `*_CRON` 환경변수로 제어되고, 동시 실행·쿨다운이 필요한 작업은 `scraperRunner.js`처럼 싱글톤 러너 모듈로 분리한다.
- **라우트**: 참여 관련 라우트는 `backend/routes/user.js`에 `authMiddleware` 보호로 모여 있다.

## Goals / Non-Goals

**Goals:**

- 워치리스트·단계 진행·리마인더 이력을 일관된 한 곳에 저장한다.
- 기존 `participatedBy` 기반 참여 기능과 API를 깨지 않는다.
- 리마인더 cron이 (사용자, 에어드랍, 마일스톤) 단위로 정확히 한 번만 푸시한다.
- 신규 외부 의존성·유료 서비스 없이 구현한다(0원 운영 유지).

**Non-Goals:**

- 기존 `participatedBy`를 신규 컬렉션으로 이전(마이그레이션)하는 것 — 비범위, breaking.
- 검색·필터(Tier 2), 입문·보안 가이드(Tier 3).
- 리마인더 발송 시각·마일스톤을 사용자가 커스터마이즈하는 설정 UI.

## Decisions

### 결정 1: 단일 `AirdropTracking` 컬렉션으로 세 기능을 모두 담는다

(사용자, 에어드랍) 쌍마다 문서 하나를 두는 신규 컬렉션 `AirdropTracking`을 만든다.

```
AirdropTracking {
  user: ObjectId<User>            // required
  airdrop: ObjectId<Airdrop>      // required
  watchlisted: Boolean            // default false
  completedTasks: [Number]        // 완료한 tasks 인덱스, default []
  remindersSent: [String]         // 'D3' | 'D1' | 'DAY', default []
  createdAt / updatedAt
}
// 복합 유니크 인덱스: { user: 1, airdrop: 1 }
// 보조 인덱스: { airdrop: 1 } (리마인더 스캐너의 역방향 조회용)
```

- **대안 A — `User` 문서에 임베드**: `watchlist`, 진행 상태를 User에 배열로. (user,airdrop)별 `completedTasks`·`remindersSent`까지 넣으면 User 문서가 무한 성장하고 부분 갱신이 까다롭다. 기각.
- **대안 B — 기능별 컬렉션 3개**: 같은 (user,airdrop) 키를 세 번 조회·관리. 워치리스트 항목이 곧 리마인더 대상이고 진행 추적 대상이므로 한 문서에 두는 게 자연스럽다. 기각.
- **채택 — 단일 컬렉션**: 워치리스트·진행·리마인더 이력이 모두 같은 키를 공유한다. 문서가 없으면 "추적 안 함"이고, 어느 한 기능이라도 쓰는 순간 upsert로 생성된다.

`Airdrop.participatedBy`는 그대로 둔다 — 기존 API 호환. 리마인더 대상 사용자 집합은 `participatedBy`(참여)와 `AirdropTracking.watchlisted=true`(관심)의 **합집합**이다.

### 결정 2: 리마인더 마일스톤은 "겹치지 않는 시간 윈도우"로 판정한다

cron이 반복 실행돼도 안전하도록, 각 마일스톤을 마감까지 남은 시간의 윈도우로 정의한다.

- `D3`: 남은 시간 48~72시간
- `D1`: 남은 시간 12~24시간
- `DAY`: 남은 시간 0~6시간

스캐너는 마감 임박(`end_date`가 미래) 에어드랍을 모아, 현재 남은 시간이 어느 윈도우에 드는지 판정하고, 그 에어드랍을 추적하는 사용자별로 **해당 마일스톤이 `remindersSent`에 없으면** 푸시 후 마일스톤을 기록한다.

- **윈도우 방식의 이유**: "임계값 이하면 발송"으로 하면 마감 40시간 전에 관심 등록한 사용자에게 `D3`(3일 전) 푸시가 잘못 발송된다. 윈도우는 늦게 등록한 사용자가 이미 지난 마일스톤을 건너뛰고 다음 마일스톤부터 받게 한다.
- cron 간격(1시간)보다 윈도우가 충분히 넓어(≥6시간) 마일스톤을 놓치지 않는다.
- `remindersSent` 기록으로 같은 (user, airdrop, 마일스톤) 중복을 차단한다.

### 결정 3: 리마인더는 기존 cron·푸시 패턴을 재사용한다

- `backend/src/services/deadlineReminders.js` — `runDeadlineReminders()` 구현. 마감 임박 에어드랍 조회 → 추적 사용자 합집합 산출 → 마일스톤 판정 → Expo 푸시 → `remindersSent` 갱신.
- `server.js`에 cron 등록 — `REMINDER_CRON_ENABLED`(default true) / `REMINDER_CRON`(default `0 * * * *`, 매시 정각). scraper/retention과 동일 패턴.
- 동시 실행 가드가 필요하면 `scraperRunner.js`와 같은 싱글톤 러너로 분리한다(설계상 단순하면 cron 콜백 내 플래그로도 충분).
- 푸시 본문은 정보 제공 톤 — 예: `"관심 등록한 '<제목>' 마감이 <N>일 남았습니다. (정보 제공 목적이며 투자 권유가 아닙니다)"`. 기존 `sendPushNotifications` 문구 규칙을 따른다.

### 결정 4: API는 `routes/user.js`에 인증 보호 라우트로 추가한다

기존 참여 라우트(`/api/user/airdrops/:id/participate`) 옆에 동일 컨벤션으로 추가:

- `POST   /api/user/airdrops/:id/watchlist` — 관심 추가 (멱등)
- `DELETE /api/user/airdrops/:id/watchlist` — 관심 제거 (멱등)
- `GET    /api/user/airdrops/watchlist` — 내 관심 목록 (에어드랍 정보 join)
- `PUT    /api/user/airdrops/:id/tasks/:index` — 단계 체크 (body `{ completed: boolean }`)
- `GET    /api/user/airdrops/:id/tracking` — 해당 에어드랍의 내 추적 상태(관심 여부 + 완료 단계 + 전체 단계 수)

모두 `authMiddleware`. 단계 인덱스는 대상 `Airdrop.tasks` 길이로 범위 검증한다.

### 결정 5: 프론트엔드 — 기존 화면에 얹는다

- `DetailScreen`: 헤더에 관심(★) 토글 버튼, `참여 방법` 섹션의 각 task에 체크박스. `tracking` API로 초기 상태 로드.
- `UserScreen`: 기존 `참여한 에어드랍` 섹션에 진행률·마감 카운트다운 추가, `관심 목록` 섹션 신설.
- 신규 훅: `useWatchlist`, `useAirdropTracking`. `services/api.js`에 API 함수 추가.

## Risks / Trade-offs

- **리마인더 대상 = 두 출처의 합집합** → 참여는 `Airdrop.participatedBy`, 관심은 `AirdropTracking`에 있어 스캐너가 두 곳을 본다. 마감 임박 에어드랍 수가 적어(보통 수십 건) 성능 부담은 미미. `{ airdrop: 1 }` 인덱스로 역방향 조회를 보강한다.
- **참여만 하고 관심 등록은 안 한 사용자의 리마인더 이력** → 그 사용자는 `AirdropTracking` 문서가 없을 수 있다. 스캐너가 푸시 시 `(user, airdrop)` 문서를 upsert하여 `remindersSent`를 기록한다(`watchlisted`는 false 유지).
- **cron 누락/중복 실행** → 윈도우 방식 + `remindersSent` 기록으로 중복은 차단. 서버 다운으로 윈도우를 통째로 놓치면 그 마일스톤은 건너뛴다(다음 마일스톤은 정상). 치명적이지 않다고 판단.
- **푸시 토큰 만료** → Expo가 거부한 토큰은 무시하고 다른 사용자 발송에 영향 주지 않는다. 기존 `sendPushNotifications`의 `Expo.isExpoPushToken` 필터를 동일 적용.
- **tasks 배열 변경** → 스크래퍼 재분류로 `Airdrop.tasks` 내용이 바뀌면 인덱스 기반 `completedTasks`가 어긋날 수 있다. 진행률은 부가 정보이므로 수용 가능한 트레이드오프로 본다(설계상 인덱스 유지, 완벽한 정합성은 비목표).

## Migration Plan

1. `AirdropTracking` 모델 추가 — 신규 컬렉션이므로 기존 데이터 영향 없음.
2. 백엔드 라우트·컨트롤러·리마인더 서비스 추가 후 배포. cron은 `REMINDER_CRON_ENABLED`로 토글 가능 — 초기엔 끄고 검증 후 켤 수 있다.
3. 프론트엔드 배포 — 신규 API 미존재 시 graceful 처리(관심/체크 UI는 로그인 사용자에게만 노출).
4. 롤백: 신규 컬렉션·라우트·cron 추가만 있고 기존 경로를 수정하지 않으므로, cron을 끄고 코드 revert하면 즉시 복귀. 데이터 손실 없음.

## Open Questions

- 리마인더 푸시를 사용자가 끄고 싶을 때(알림 설정) — 이번 범위에서는 OS 알림 권한으로만 통제. 인앱 토글은 후속 과제로 둘지?
- `DAY` 윈도우(0~6h)를 더 좁혀 "마감 임박" 강조 푸시를 한 번 더 줄지 — 출시 후 사용자 반응으로 재검토.
