# 백엔드 배포 가이드 — Render + MongoDB Atlas

Expo 앱의 `app.json` `expo.extra.backendUrl`에 채워 넣을 HTTPS API URL을 만드는 절차.
소요 시간: 30~60분. 비용: Render starter $7/월 + MongoDB Atlas M0 무료.

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

## 5. 비용 / 제한

| 항목 | Free | Starter ($7/월) |
|---|---|---|
| 상시 실행 | ❌ 15분 idle 후 sleep | ✅ |
| in-process cron | ❌ sleep 중 중단 | ✅ |
| 메모리 | 512MB | 512MB |
| CPU | 0.1 | 0.5 |
| Build time | 500min/월 | 500min/월 |

- `render.yaml`의 `plan: starter`는 cron 보존이 목적. Free로도 동작은 하지만 스크래퍼가 멈춤.
- 그래도 free로 가고 싶으면:
  1. `render.yaml`의 `plan: starter` → `plan: free`
  2. https://uptimerobot.com 무료 가입 → 5분마다 `/health` ping
  3. 단 — 무료에 cron 신뢰성을 100% 기대 X. 14분 idle 직전에만 깨우니까 cron 0분 정각을 놓칠 수 있음.

---

## 6. 로그/장애 대응

- Render Dashboard → 서비스 → **Logs** 탭에서 실시간 로그
- `console.error` 출력은 자동 캡처
- Sentry/Logtail 등 외부 모니터링 도입은 별도 작업

## 7. 다음 단계

- `JWT_SECRET` 6개월마다 회전(전체 사용자 재로그인 강제) — Render Dashboard에서 값 교체
- Atlas M0 용량(512MB) 초과 임박 시 News retention 일수 축소(`pruneOldNews`의 `NEWS_RETENTION_DAYS`)
- 트래픽 증가 시 Atlas M10 + Render standard로 업그레이드
