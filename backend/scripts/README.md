# backend/scripts/

사람이 CLI에서 직접 실행하는 **일회성 도구** 모음. 운영 코드와 다른 책임을 가지므로 별도 정책이 적용됩니다.

## 로깅 정책

- 운영 코드(`app.js` / `controllers/` / `middleware/` / `src/services/`)는 **`src/lib/logger.js`(pino)**로 통일됨
- **`scripts/`는 `console.*` 그대로 사용** — 의도된 정책
  - 이유 1: 사람이 터미널에서 직접 읽음 → JSON 한 줄 출력은 가독성 저하
  - 이유 2: Render Logs 같은 운영 파이프라인을 타지 않음 → 구조화 로그의 이점이 없음
  - 이유 3: cron이 호출하는 진입점은 `app.js`/`scraperRunner` 쪽이지 `scripts/`가 아님

만약 어떤 스크립트가 자동화/cron 진입점으로 승격되면 그때 운영 코드 쪽으로 옮기고 logger를 쓰면 됩니다.

## 디렉토리 구성

- `scraper/run.js` — `runScraper()` 1회 호출. 평소엔 cron이 자동 실행하므로 사람이 호출할 일은 디버깅뿐.
- `db/` — 시드/덤프/체크/클리어 등 DB 직접 조작
- `dev/` — 일회성 검증·디버깅(`verify_*`, `probe_*`, 재분류 스크립트 등)
- `migrations/` — 한 번 돌리고 끝나는 데이터 마이그레이션
- `sentry-test.js` — SENTRY_DSN 동작 검증. exit code로 자동화 가능 (`npm run sentry:test`)
- `test_api.js` — 수동 API 통합 검증. Jest 도입 이후엔 `npm test`가 주력.

## 실행 방법

대부분 `node scripts/<path>.js` 형태. 일부는 npm script로 노출:

```bash
npm run scraper:once   # node scripts/scraper/run.js
npm run sentry:test    # node scripts/sentry-test.js
npm run test:api       # node scripts/test_api.js
```
