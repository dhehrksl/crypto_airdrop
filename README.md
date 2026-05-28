# 크립토 에어드랍

가상화폐 에어드랍 정보를 자동으로 모아서 한국어로 정리해 보여주는 모바일 앱.

여기저기 흩어진 에어드랍 정보를 사람이 일일이 찾을 필요 없이, 봇이 모으고 AI가 스캠을 걸러서 깔끔한 목록만 보여준다.

---

## 어떤 앱인가

- 에어드랍 정보를 한 곳에서 본다
- 관심 있는 거 찜해두면 마감 전에 푸시로 알려준다
- 회원가입은 이메일만, 다른 개인정보 안 받는다
- 광고는 가끔 나온다 (AdMob)

## 기술 스택

- 앱: React Native + Expo
- 서버: Node.js + Express
- DB: MongoDB (Atlas)
- AI: Google Gemini
- 배포: Render (서버) + Play Store (앱)

---

## 폴더 구조

```
backend/    서버 코드 (Express + MongoDB)
frontend/   앱 코드 (Expo React Native)
docs/       문서 (실행법, 배포법, 정책 등)
```

---

## 로컬에서 돌려보기

자세한 건 [`docs/HOW_TO_RUN.md`](docs/HOW_TO_RUN.md).

**서버 띄우기**

```bash
cd backend
npm install
cp .env.example .env       # GEMINI_API_KEY, JWT_SECRET 채우기
npm start
```

**에어드랍 한 번 긁어오기**

```bash
npm run scraper:once
```

**앱 띄우기** (서버랑 같은 와이파이에 폰 연결)

```bash
cd frontend
npm install
npx expo start             # QR 찍으면 Expo Go에서 열림
```

`frontend/app.json`의 `backendUrl`을 컴퓨터 LAN IP로 맞춰야 폰에서 서버에 붙는다.

---

## 운영

- **서버 배포 방법**: [`docs/deployment-render.md`](docs/deployment-render.md)
- Render 무료 플랜 + UptimeRobot으로 안 자게 함
- 매시 정각에 RSS 자동 수집 (cron)
- Gemini 무료 한도 다 쓰면 다른 모델로 자동 전환

---

## Play Store 출시 단계

체크리스트 전체: [`docs/launch-checklist.md`](docs/launch-checklist.md)

1. **개인정보처리방침 공개 URL 호스팅** — Play Console이 필수로 요구함. 방법: [`docs/policy-hosting-guide.md`](docs/policy-hosting-guide.md)
2. **MongoDB Atlas** 만들어서 Render 서버에 연결
3. **EAS Build로 Android AAB 빌드** → Play Console 업로드
4. **AdMob 광고 ID** 발급받아서 `frontend/app.json`에 넣기

---

## 수집하는 개인정보

| 뭘 받나 | 언제 | 왜 |
|---|---|---|
| 사용자 이름 | 회원가입 | 표시용 |
| 이메일 | 회원가입 | 로그인 |
| 비밀번호 | 회원가입 | bcrypt 해시로 저장 (원본 안 남김) |
| 푸시 토큰 | 알림 켤 때만 | 마감 알림 발송 |
| 광고 ID | 자동 | AdMob 광고 빈도 제어 |

실명, 생년월일, 휴대전화, 주소, 결제정보 — **하나도 안 받는다.**

---

## 라이선스

비공개 (개인 운영).
