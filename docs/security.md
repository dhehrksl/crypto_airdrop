# 보안 정책 (backend)

`harden-backend-security` change로 도입된 baseline 보안 정책 요약. 운영 배포 시 참고.

## 환경변수

| 변수 | 기본 | 운영 권장 |
|------|------|----------|
| `NODE_ENV` | `development` | `production` |
| `JWT_SECRET` | (없음, fallback 약함) | `crypto.randomBytes(48).toString('base64url')` |
| `JWT_EXPIRES_IN` | `1d` | `1d` 또는 `12h` |
| `CORS_ALLOWED_ORIGINS` | 비어있음 | `https://app.example.com,https://www.example.com` (쉼표 구분) |
| `SCRAPER_ADMIN_TOKEN` | 비어있음 (인증 우회) | `crypto.randomBytes(32).toString('hex')` |
| `GOOGLE_CLIENT_ID` / `_SECRET` | `dummy` | 실제 값 (사용 시) |

## 미들웨어 스택 순서

```
runSecuritySelfCheck()  // 부팅 시 1회, fail-fast (production + CORS 누락 시 exit 1)
↓
helmet({ contentSecurityPolicy: false })  // 표준 보안 헤더 (X-Frame-Options 등)
↓
cors({ origin: <whitelist function> })    // CORS_ALLOWED_ORIGINS 기반
↓
express.json()
↓
/api/auth → authLimiter (5/15min)
/api/*    → generalLimiter (100/15min, scraper/auth path 제외)
↓
passport.initialize()
↓
... 라우트 ...
/api/submissions POST → submissionLimiter (10/1hour)
↓
errorHandler  // 마지막. production이면 일반화, dev면 stack 포함
```

## Rate limit 한도

| 라우트 그룹 | 한도 | 윈도우 | 비고 |
|-----------|------|--------|------|
| `/api/auth/*` | 5 | 15분 | 브루트포스 방어 |
| `/api/submissions` POST | 10 | 1시간 | 스팸 방어 |
| `/api/*` (auth/scraper 제외) | 100 | 15분 | DoS 완화 |
| `/api/scraper/run` | 토큰 + 30분 쿨다운 | - | rate-limit 적용 X |

분산 배포 전환 시 메모리 store → Redis store 교체 필요 (별도 change).

## 입력 검증

- **이메일**: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` (RFC 5322 단순화)
- **비밀번호**: 최소 8자 + 영문 1자 이상 + 숫자 1자 이상
- 실패 시 응답: `400 { error: 'invalid_email' | 'weak_password' }`

## 부팅 자가 진단 항목

- `JWT_SECRET`이 알려진 약한 값(`change-me-...`, `your-super-secret-...`, 빈 값) → 경고
- `SCRAPER_ADMIN_TOKEN` 빈 값 → 경고
- production + `GOOGLE_CLIENT_ID=dummy` → 경고
- production + `CORS_ALLOWED_ORIGINS` 빈 값 → **부팅 거부 (exit 1)**

## 운영 배포 전 체크리스트

1. 모든 시크릿(JWT_SECRET, SCRAPER_ADMIN_TOKEN, GEMINI_API_KEY) 회전
2. `NODE_ENV=production` 설정
3. `CORS_ALLOWED_ORIGINS`에 운영 도메인 등록
4. `GOOGLE_CLIENT_ID` / `_SECRET` 실제 값 (Google 로그인 사용 시)
5. 부팅 시 `[보안 치명적]` 로그 없는지 확인 (있으면 exit 1로 부팅 자체 실패)
6. (별도 change) HTTPS 인증서, 도메인, 호스팅, MongoDB Atlas 등

## 검증 스크립트

```bash
node scripts/dev/verify_security_integration.js
# 헬멧 헤더 / CORS / rate-limit / 입력 검증 / JWT exp / errorHandler 7개 그룹 12 케이스
```

## 범위 밖 (별도 change)

- WAF / DDoS / Cloudflare
- 2FA / refresh token / OAuth provider 추가
- CSRF protection (현재 stateless JWT라 surface 작음)
- 보안 모니터링 / SIEM 연동
- Redis 기반 rate-limit store (분산 환경)
