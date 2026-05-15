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
   ```
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

## 4. 확정 에어드랍 데이터베이스 시딩

테스트를 위한 확정 에어드랍 샘플 데이터를 데이터베이스에 추가합니다. 이 데이터에는 실시간 가격 정보를 위한 `tokenTicker`가 포함됩니다.

1. `backend` 디렉토리로 이동합니다:
   ```bash
   cd backend
   ```
2. 시딩 스크립트를 실행합니다:
   ```bash
   node scripts/db/seedGuaranteed.js
   ```
