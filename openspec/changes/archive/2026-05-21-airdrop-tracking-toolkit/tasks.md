## 1. 데이터 모델

- [x] 1.1 `backend/models/AirdropTracking.js` 생성 — `user`, `airdrop`, `watchlisted`, `completedTasks`, `remindersSent` 필드 + `{ user: 1, airdrop: 1 }` 복합 유니크 인덱스 + `{ airdrop: 1 }` 보조 인덱스

## 2. 워치리스트 백엔드

- [x] 2.1 워치리스트 컨트롤러 — 추가(`addToWatchlist`)·제거(`removeFromWatchlist`)·조회(`getWatchlist`) 구현. 추가/제거는 멱등 upsert, 존재하지 않는 에어드랍은 404
- [x] 2.2 `backend/routes/user.js`에 `POST/DELETE /api/user/airdrops/:id/watchlist`, `GET /api/user/airdrops/watchlist` 라우트 추가 (`authMiddleware` 보호)

## 3. 단계별 진행 백엔드

- [x] 3.1 진행 컨트롤러 — 단계 체크/해제(`setTaskProgress`)·추적 상태 조회(`getTracking`) 구현. 인덱스를 대상 `Airdrop.tasks` 길이로 범위 검증(벗어나면 400)
- [x] 3.2 `backend/routes/user.js`에 `PUT /api/user/airdrops/:id/tasks/:index`, `GET /api/user/airdrops/:id/tracking` 라우트 추가 (`authMiddleware` 보호)

## 4. 마감 리마인더 서비스 + cron

- [x] 4.1 `backend/src/services/deadlineReminders.js` 생성 — `runDeadlineReminders()`: 마감 임박(`end_date` 미래) 에어드랍 조회 → 추적 사용자 합집합(`participatedBy` ∪ `watchlisted`) 산출 → 마일스톤(D3/D1/DAY) 윈도우 판정
- [x] 4.2 마일스톤별 Expo 푸시 발송 — 기존 `sendPushNotifications` 패턴 재사용, `Expo.isExpoPushToken` 필터, 정보 제공 톤 문구
- [x] 4.3 발송 후 `(user, airdrop)` `AirdropTracking` 문서를 upsert하여 `remindersSent`에 마일스톤 기록 — 같은 (user, airdrop, 마일스톤) 중복 발송 차단
- [x] 4.4 `server.js`에 리마인더 cron 등록 — `REMINDER_CRON_ENABLED`(default true) / `REMINDER_CRON`(default `0 * * * *`) 환경변수, scraper/retention과 동일 패턴

## 5. 프론트엔드 — API·훅

- [x] 5.1 `frontend/src/services/api.js`에 워치리스트·단계 진행·추적 상태 API 함수 추가
- [x] 5.2 `useWatchlist`·`useAirdropTracking` 훅 생성

## 6. 프론트엔드 — 화면

- [x] 6.1 `DetailScreen` — 헤더에 관심(★) 토글 버튼 추가, `tracking` API로 초기 관심/진행 상태 로드
- [x] 6.2 `DetailScreen` — `참여 방법` 섹션의 각 task에 체크박스 추가, 체크 시 진행 API 호출 + 진행률 표시
- [x] 6.3 `UserScreen` — `참여한 에어드랍` 섹션에 진행률·마감 카운트다운 표시
- [x] 6.4 `UserScreen` — `관심 목록` 섹션 신설 (관심 목록 조회·항목 탭 시 DetailScreen 이동)

## 7. 검증

- [x] 7.1 워치리스트 단위/통합 테스트 — 추가·제거 멱등성, 404, 사용자 격리, 401
- [x] 7.2 단계 진행 테스트 — 체크/해제, 범위 밖 인덱스 400, 진행률 산출, tasks 없는 에어드랍, 401
- [x] 7.3 리마인더 테스트 — D3/D1/DAY 윈도우 판정, 추적 사용자 합집합, 중복 발송 차단, 푸시 토큰 없음·마감된 에어드랍 제외
- [x] 7.4 `backend` 전체 테스트 실행(`npm test`) 통과 확인
- [x] 7.5 `openspec validate airdrop-tracking-toolkit`로 스펙 정합성 확인
