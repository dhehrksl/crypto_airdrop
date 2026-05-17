# Migrations

운영 DB에 일회성 영향을 주는 스크립트 모음. 모두 `--dry-run`이 기본이며 `--apply` 플래그가 있을 때만 실제 변경을 수행한다.

## 적용 전 체크리스트

1. **DB 백업** — 적용 전 반드시 한 번:
   ```
   mongodump --uri "$MONGODB_URI" --out backup-$(date +%Y%m%d-%H%M%S)
   ```
2. 먼저 `--dry-run`(플래그 없이 실행)으로 영향 범위 확인
3. 결과가 예상과 일치하면 `--apply` 로 재실행
4. 적용 후 `node scripts/dump_db.js` 또는 도메인별 점검으로 결과 확인

## 스크립트

### `purge-blocked-sources.js`

`src/config/blockedSources.js`에 등록된 차단 출처(예: airdrops.io)에서 적재된 Airdrop/News 항목을 **영구 삭제**한다.

```
node scripts/migrations/purge-blocked-sources.js              # 매치 건수 + 샘플 출력
node scripts/migrations/purge-blocked-sources.js --apply      # 실제 삭제
```

새 출처를 차단 대상으로 추가했을 때도 동일 스크립트로 정리할 수 있다.

### `demote-expired-airdrops.js`

`end_date < now`인 Airdrop을 News로 강등한다. 이후엔 `server.js`의 retention cron(매일 03:00 KST)이 자동 처리하므로, 이 스크립트는 정책 도입 직후 1회 실행하면 충분하다.

```
node scripts/migrations/demote-expired-airdrops.js            # 만료 건수 출력
node scripts/migrations/demote-expired-airdrops.js --apply    # 실제 강등
```

강등은 _id와 created_at을 보존한다(푸시 deep link 호환 + News 3일 보관 정책 일관).

## 순서 (출시 전 1회)

```
1. mongodump
2. node scripts/migrations/purge-blocked-sources.js           # dry-run
3. node scripts/migrations/purge-blocked-sources.js --apply
4. node scripts/dump_db.js                                    # airdrops.io 0건 확인
5. node scripts/migrations/demote-expired-airdrops.js         # dry-run
6. node scripts/migrations/demote-expired-airdrops.js --apply
```
