# 백엔드 배포 가이드 — Render + MongoDB Atlas

Expo 앱의 `app.json` `expo.extra.backendUrl`에 채워 넣을 HTTPS API URL을 만드는 절차.
소요 시간: 30~60분. **비용: 전부 무료** (Render Free + MongoDB Atlas M0 + UptimeRobot).

---

## 1. MongoDB Atlas — DB 준비 (무료 M0)

1. https://www.mongodb.com/cloud/atlas/register 가입
2. **Build a Database** → **M0 FREE** 선택 → Provider=AWS, Region=Singapore(`ap-southeast-1`) 권장 (Render의 Singapore와 동일 region)
3. **Username/Password** 생성 — 강한 랜덤 (이후 URI에 들어감)
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
   - Render는 IP가 가변이라 화이트리스트 불가. Atlas의 username+password 인증만으로 보호.
5. **Connect** → **Drivers** → Node.js → URI 복사
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. URI 끝에 DB 이름 `crypto_airdrop` 삽입:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/crypto_airdrop?retryWrites=true&w=majority
   ```

> 보관: 이 URI는 Render의 `MONGODB_URI` 시크릿에 들어간다. 절대 git에 커밋하지 않음.

---

## 2. Render — 백엔드 배포

### 2.1 가입 + repo 연결
1. https://render.com 가입 (GitHub 계정으로)
2. Dashboard → **New +** → **Blueprint**
3. **Connect a repository** → `dhehrksl/crypto_airdrop` 선택
4. Render가 repo 루트의 `render.yaml`을 감지 → 서비스 정의를 미리보기

### 2.2 시크릿 입력 (Render가 프롬프트함)
| 변수 | 값 |
|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` 출력값 |
| `SCRAPER_ADMIN_TOKEN` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 출력값 |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey 발급값 |
| `MONGODB_URI` | 위 1단계에서 만든 Atlas URI |
| `SENTRY_DSN` | (선택) Sentry 프로젝트 DSN — 9번 섹션 참고. 비워두면 에러 트래킹 비활성 |

> 모바일 native는 origin 헤더가 없어 `CORS_ALLOWED_ORIGINS`는 빈 값이어도 작동.
> Render는 production에서 빈 CORS를 부팅 거부하므로 임의값 하나 넣어야 함 (예: `https://api.placeholder.local`).
> 관리자 웹/Expo Web 빌드를 따로 호스팅하면 그 URL을 넣을 것.

### 2.3 배포
**Apply** 클릭 → 첫 빌드 시작 (3~5분).

로그에서 다음 라인이 보이면 정상:
```
MongoDB Connected
Backend server running on port 10000
[Scraper] cron scheduled: "0 * * * *"
```

부팅 거부가 나면 로그에 `[보안 치명적]` 라인이 보임 → 해당 시크릿 다시 확인.

### 2.4 발급된 URL 확인
서비스 페이지 상단에 `https://crypto-airdrop-api.onrender.com` 형태의 URL.

```bash
curl https://crypto-airdrop-api.onrender.com/health
# {"ok":true,"uptimeSec":42,"mongo":"connected","ts":"2026-05-19T..."}
```

---

## 3. Expo 앱에 백엔드 URL 연결

`frontend/app.json`:
```json
"extra": {
  "backendUrl": "https://crypto-airdrop-api.onrender.com",
  ...
}
```

`backendPort`는 무시됨 (URL에 포트 포함될 일 없음).

EAS dev/preview 빌드 또는 production 빌드를 다시 만들어야 반영.

---

## 4. 운영 후 검증

### 4.1 회원가입 → 로그인 → 토큰 발급
```bash
curl -X POST https://crypto-airdrop-api.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"test1","email":"t@example.com","password":"abcd1234"}'
```

### 4.2 스크래퍼 수동 트리거 (관리자 토큰 필요)
```bash
curl -X POST https://crypto-airdrop-api.onrender.com/api/scraper/run \
  -H "Authorization: Bearer $SCRAPER_ADMIN_TOKEN"
```

### 4.3 첫 사용자에게 관리자 권한 부여 (앱 내 어드민 화면 사용 위해)
Atlas → Data Explorer → `users` 컬렉션 → 본인 문서 편집 → `isAdmin: true` 추가.
또는 MongoDB Compass로 동일 작업.

---

## 5. UptimeRobot — Free 플랜 cron 깨우기 (필수)

Free 플랜은 15분 동안 요청 없으면 sleep → 그 시간엔 in-process cron 안 돔.
UptimeRobot 무료로 5분마다 `/health`에 ping 쏴서 깨워둠.

1. https://uptimerobot.com 무료 가입
2. **+ Add New Monitor**
3. 설정:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `crypto-airdrop-api`
   - URL: `https://crypto-airdrop-api.onrender.com/health`
   - Monitoring Interval: **5 minutes** (무료 최대 빈도)
4. Create Monitor

> **한계**: 5분 ping이라 cron 0분 정각을 가끔 놓침. 사용자 많아져서 트래픽으로 항상 깨어 있으면 문제 없음. 출시 초기엔 데이터 1~2시간 늦는 경우 있어도 무료라 감수.

## 6. 비용 / 제한

| 항목 | Free (현재) | Starter ($7/월, 나중에 업그레이드) |
|---|---|---|
| 상시 실행 | ❌ 15분 idle 후 sleep (UptimeRobot로 우회) | ✅ |
| in-process cron | △ 5분 ping 사이엔 동작 | ✅ |
| 메모리 | 512MB | 512MB |
| CPU | 0.1 | 0.5 |
| Build time | 500min/월 | 500min/월 |

**언제 starter로 올리나**: 사용자 늘어서 데이터 지연이 문제가 되거나, cron 정각 100% 보장이 필요할 때. 출시 초기엔 free로 충분.

---

## 7. 로그/장애 대응

- Render Dashboard → 서비스 → **Logs** 탭에서 실시간 로그
- `console.error` 출력은 자동 캡처
- `SENTRY_DSN` 설정 시 5xx 에러와 미처리 예외는 Sentry에 자동 캡쳐됨 (9번 섹션 참고)

## 8. 다음 단계

- `JWT_SECRET` 6개월마다 회전(전체 사용자 재로그인 강제) — Render Dashboard에서 값 교체
- Atlas M0 용량(512MB) 초과 임박 시 News retention 일수 축소(`pruneOldNews`의 `NEWS_RETENTION_DAYS`)
- 트래픽 증가 시 Atlas M10 + Render standard로 업그레이드

---

## 9. Sentry — 에러 트래킹 (선택, 권장)

운영 환경에서 발생하는 5xx 에러와 미처리 예외를 자동 수집·알림.
**비용: 무료 플랜으로 월 5,000 에러 + 10,000 트랜잭션** (출시 초기 충분).

### 9.1 Sentry 프로젝트 생성
1. https://sentry.io 가입 (GitHub 계정으로)
2. **Create Project** → Platform: **Node.js** → 프로젝트 이름 `crypto-airdrop-api`
3. 생성 후 **Settings → Projects → crypto-airdrop-api → Client Keys (DSN)** 에서 DSN 복사
   ```
   https://xxxxxxxxxxxx@oNNNNNN.ingest.us.sentry.io/NNNNNNN
   ```

### 9.2 Render에 DSN 주입
Render Dashboard → 서비스 → **Environment** → `SENTRY_DSN`을 위 DSN 값으로 설정 → **Save**.
재배포되면 부팅 로그에 다음 라인이 보임:
```
[Sentry] initialized { env: 'production' }
```
DSN 미설정 시:
```
[Sentry] SENTRY_DSN 미설정 — 운영 에러 트래킹이 비활성화됩니다.
```

### 9.3 샘플링 비율 조정 (선택)
- `SENTRY_TRACES_SAMPLE_RATE` (기본 0.1) — 트랜잭션 추적 샘플링. 트래픽이 늘어 비용이 부담되면 0.05로 낮춤.
- `SENTRY_PROFILES_SAMPLE_RATE` (기본 0.1) — 프로파일링 샘플링. traces가 캡쳐된 트랜잭션 중 비율.

### 9.4 프론트엔드 Sentry (별도)
모바일 앱(Expo)도 동일한 Sentry 조직 안에 별도 프로젝트로 생성:
- Platform: **React Native** → 프로젝트 이름 `crypto-airdrop-mobile`
- DSN을 `frontend/app.json` `expo.extra.sentry.dsn`에 입력하거나 EAS Secret `SENTRY_DSN`으로 빌드 타임 주입
- production 빌드(EAS Build)에서만 활성 — 개발/Expo Go는 DSN 미설정 시 no-op

### 9.5 검증

**옵션 A — CLI 스크립트 (권장, 가장 빠름)**
```bash
cd backend
# .env에 SENTRY_DSN이 있으면:
npm run sentry:test
# 또는 직접 주입:
SENTRY_DSN='https://xxx@oNNN.ingest.us.sentry.io/NNN' npm run sentry:test
```
스크립트가 `captureMessage` + `captureException`을 보낸 뒤 `Sentry.flush(5s)`로 ack를 기다립니다. exit 0이면 transport 단까지 정상 — Sentry **Issues** 탭에 다음 라벨로 나타납니다(수신까지 수 초 소요):
- `sentry-test: hello from CLI ...`
- `sentry-test: synthetic error from CLI ...`

flush 타임아웃이면 DSN/네트워크/프로젝트 quota 확인.

**옵션 B — 실제 errorHandler 경로까지 e2e 검증 (dev/test 환경에서)**
백엔드를 띄운 상태에서:
```bash
curl http://localhost:3000/api/_debug/throw
```
이 라우트는 `NODE_ENV=production`에서는 등록되지 않으므로 운영 검증엔 옵션 A를 쓰세요.

**프론트엔드(React Native) 검증**
스크립트로 자동화 불가 — `@sentry/react-native`는 네이티브 모듈이라 EAS Build/dev-client에서만 동작합니다.
1. `frontend/app.json`의 `expo.extra.sentry.dsn`(혹은 EAS Secret) 설정
2. EAS dev-client 빌드 → 디바이스에서 앱 실행
3. `App.js`에 일시적으로 한 줄 추가하거나, 일부러 throw하는 디버그 버튼을 잠시 둠:
   ```js
   import { captureException } from './src/services/sentryConfig';
   captureException(new Error('frontend sentry-test'));
   ```
4. Sentry **모바일 프로젝트** Issues 탭에 표시되는지 확인 → 검증 후 코드 롤백
