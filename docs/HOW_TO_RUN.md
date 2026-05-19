# 프로젝트 실행 방법

이 프로젝트는 백엔드 서버와 프론트엔드 리액트 네이티브(Expo) 애플리케이션으로 구성되어 있습니다. 애플리케이션이 정상적으로 작동하려면 두 가지 모두 동시에 실행되어야 합니다.

## 1. 백엔드 설정

### 사전 준비 사항
- Node.js 설치
- MongoDB 설치 및 실행

### 단계
1. `backend` 디렉토리로 이동합니다:
   ```bash
   cd backend
   ```
2. 의존성을 설치합니다:
   ```bash
   npm install
   ```
3. `backend` 디렉토리에 `.env` 파일을 생성하고, 필요한 경우 플레이스홀더 값을 교체하여 다음 내용을 추가합니다:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/crypto_airdrop
   JWT_SECRET=your-super-secret-key-that-is-long
   # (선택) 에러 트래킹 — 운영 배포 시 권장. 로컬 개발에서는 비워둠.
   # SENTRY_DSN=https://xxxxxxxxxxxx@oNNNNNN.ingest.us.sentry.io/NNNNNNN
   # (선택) 로그 레벨 — 기본은 development=debug / production=info / test=silent.
   # LOG_LEVEL=info
   ```

   **로그 출력 형식**:
   - **development**: `pino-pretty`로 컬러/포맷팅된 사람-친화 출력
   - **production**: 단일 라인 JSON (Render Logs / CloudWatch 등 파싱 친화). `SENTRY_DSN` 설정 시 5xx 자동 캡쳐.
   - **test**: silent
   - 비밀번호/토큰/Authorization 헤더는 자동 마스킹(`[REDACTED]`)됨
4. 백엔드 서버를 시작합니다:
   ```bash
   node server.js
   ```
   서버가 시작되면 "MongoDB Connected" 및 "Backend server running on port 3000" 메시지가 표시됩니다.

## 2. 프론트엔드 설정

### 사전 준비 사항
- Node.js 설치
- 모바일 기기(iOS 또는 Android)에 Expo Go 앱 설치
- 컴퓨터와 동일한 Wi-Fi 네트워크에 연결된 모바일 기기

### 단계
1. `frontend` 디렉토리로 이동합니다:
   ```bash
   cd frontend
   ```
2. **(선택 사항, 오류 발생 시)** `npm` 캐시를 지웁니다:
   ```bash
   npm cache clean --force
   ```
   이후, `node_modules`와 `package-lock.json`을 삭제합니다:
   ```bash
   Remove-Item -Recurse -Force -Path node_modules, package-lock.json
   ```
3. **의존성을 설치합니다 (중요: 두 단계로 진행):**
   ```bash
   npm install
   npx expo install --fix
   ```
   이 과정을 통해 모든 기본 패키지가 설치되고 Expo 프로젝트에 맞게 버전이 조정됩니다.
4. **`app.json` 설정:** `frontend/app.json` 파일을 열어 `expo` 객체 안에 `scheme` 속성을 추가합니다. 이는 Google 소셜 로그인 리디렉션을 위해 필요합니다.
   ```json
   {
     "expo": {
       // ... 기존 내용 ...
       "slug": "frontend",
       "scheme": "cryptoairdrop", // 이 줄을 추가합니다.
       // ... 나머지 내용 ...
     }
   }
   ```
5. **`AuthContext.js` Google Client ID 설정:** `frontend/src/context/AuthContext.js` 파일을 열어 `useAuthRequest` 훅 안에 있는 Google Client ID 플레이스홀더(`YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com` 등)를 실제 Google Cloud Console에서 발급받은 ID로 교체합니다.
6. **API 서버 주소를 업데이트합니다.** `frontend/src/services/api.js`를 열고 `API_BASE_URL` 상수를 수정합니다. 플레이스홀더 IP를 **백엔드 서버가 실행 중인 컴퓨터의 로컬 IP 주소**로 교체합니다.
   ```javascript
   // 예: 컴퓨터의 로컬 IP가 192.168.1.100인 경우
   const API_BASE_URL = 'http://192.168.1.100:3000';
   ```
7. **Expo 개발 서버를 시작합니다 (캐시를 지우고 시작):**
   ```bash
   npx expo start -c
   ```
8. 터미널에 QR 코드가 표시됩니다. 모바일 기기에서 Expo Go 앱을 열고 QR 코드를 스캔하여 애플리케이션을 실행합니다.

## 3. 데이터 스크래핑

에어드랍 및 뉴스 데이터로 데이터베이스를 채우려면 스크래퍼 스크립트를 실행해야 합니다.

1. `backend` 디렉토리로 이동합니다:
   ```bash
   cd backend
   ```
2. 스크래퍼를 실행합니다:
   ```bash
   node scripts/scraper/run.js
   ```
   새로운 데이터를 가져오고 싶을 때마다 이 스크립트를 실행할 수 있습니다. 스크래핑 전에 기존 데이터를 지우려면 다음을 실행하면 됩니다:
   ```bash
   node scripts/db/clear.js
   ```

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml`이 `push to main`과 `pull_request to main`에서 자동 실행됩니다.

**검증 항목**:
- **backend-test**: Node 20 + `npm ci` + `npm test` (7 suites · 85 tests). mongodb-memory-server의 mongod 바이너리는 캐시되어 후속 실행이 빠릅니다.
- **frontend-install**: Node 20 + `npm ci`만 (의존성 해상도 회귀 감지용). Metro 번들/EAS Build는 비용이 커서 CI에서 돌리지 않고 EAS에서 별도 확인.

**같은 PR에 새 커밋 push 시 이전 실행 자동 취소** — 무료 분량 절약.

### PR 머지 차단 (권장)

CI 실패 시 머지를 막으려면 GitHub repo에서 직접 설정:
1. Settings → Branches → **Add branch ruleset** (또는 Add protection rule) — Target: `main`
2. **Require status checks to pass** 활성화 → `Backend (Jest)` / `Frontend (install check)` 두 check를 required로 추가
3. **Require branches to be up to date before merging** 활성화 (권장)

> 첫 PR 한 번은 CI를 돌려야 status check 이름이 목록에 나타납니다.

---

## 5. 확정 에어드랍 데이터베이스 시딩

테스트를 위한 확정 에어드랍 샘플 데이터를 데이터베이스에 추가합니다. 이 데이터에는 실시간 가격 정보를 위한 `tokenTicker`가 포함됩니다.

1. `backend` 디렉토리로 이동합니다:
   ```bash
   cd backend
   ```
2. 시딩 스크립트를 실행합니다:
   ```bash
   node scripts/db/seedGuaranteed.js
   ```

## 6. 테스트 실행

`backend`에는 Jest 단위 + 통합 테스트가 셋업되어 있습니다.
```bash
cd backend
npm test                # 전체 (7 suites · 85 tests · ~6초)
npm run test:watch      # 파일 변경 시 재실행
npm run test:coverage   # 커버리지 리포트
```
첫 실행은 mongodb-memory-server가 mongod 바이너리를 받느라 1~2분 추가될 수 있습니다 (후속은 캐시).
