# Render 스크래퍼 cron 동작 확인 절차

운영 환경(Render Free + UptimeRobot)에서 스크래퍼 cron(`0 * * * *`, 매시 정각)이
자동 실행되는지 점검하는 순서. 위에서부터 한 단계씩, 결과를 보고 다음으로 진행한다.

관련 배경: `deployment-render.md` 5·6·7장 (Render Free sleep, UptimeRobot, 비용).

---

## STEP 0 — Render URL 확인

1. https://render.com 로그인 → Dashboard
2. 백엔드 서비스(`crypto-airdrop-api` 류) 클릭
3. 페이지 상단의 `https://....onrender.com` URL 복사 → 아래 `<URL>`에 사용

## STEP 1 — 서버가 살아 있나? (`/health`)

PowerShell 프롬프트:

```
! Invoke-RestMethod https://<URL>/health
```

- `ok:true` + `mongo:"connected"` → **STEP 2로**
- 응답 없음/에러 → 서버 sleep 중. 30초~1분 뒤 재시도. 그래도 안 되면 **STEP 4**로 가서 부팅 실패 여부 확인.

## STEP 2 — 스크래퍼가 최근에 돌았나? (`/api/scraper/status`)

```
! Invoke-RestMethod https://<URL>/api/scraper/status | ConvertTo-Json
```

응답의 `lastRunAt`을 본다:

- 직전 정각(:00) 근처 시각 → cron 동작 중. **STEP 3으로** (교차 확인)
- `null` 또는 아주 오래된 값 → 판단 보류. `lastRunAt`은 프로세스 메모리 상태라
  Render Free가 sleep→재시작하면 초기화된다. **STEP 4가 결정적** → STEP 4로

## STEP 3 — 서버가 한 시간 이상 떠 있나? (`/health`의 uptime)

```
! Invoke-RestMethod https://<URL>/health
```

- `uptimeSec` ≥ 3600 → 프로세스가 cron 발화 기회를 가짐. 양호.
- 매번 수백 초 이하 → 계속 sleep/재시작 중. **STEP 5**(UptimeRobot 점검) 필요.

## STEP 4 — Render 로그에서 직접 확인 (결정적)

1. Render 서비스 페이지 → **Logs** 탭
2. 우측 위 시간 범위를 **지난 3~6시간**으로 설정
3. 검색창에 `Scraper` 입력 후 다음을 찾는다:
   - `[Scraper] cron scheduled` — 부팅 시 cron 등록됨 (1회)
   - `[Scraper] triggered {"reason":"cron"}` — 정각마다 발화 (핵심)
   - `--- Scraper finished ---` — 스크랩 1회 완료
4. 판정:
   - 매시 :00 근처에 `triggered reason:"cron"` → `Scraper finished`가 **반복** → ✅ 정상. 확인 끝.
   - `cron scheduled`만 있고 `triggered cron`이 없음 → 서버가 정각마다 죽어 있음 → **STEP 5로**
   - `cron scheduled`조차 없음 → cron 비활성 의심 → **STEP 6으로**

## STEP 5 — UptimeRobot 점검 (cron이 정각을 놓칠 때)

1. https://uptimerobot.com 로그인
2. `crypto-airdrop-api` 모니터 확인:
   - 상태가 **Up**(초록)인가?
   - URL이 `https://<URL>/health` 맞는가?
   - Interval이 **5 minutes**인가?
3. 모니터가 없거나 멈춤 → `deployment-render.md` 5장대로 새로 생성
4. 그래도 정각 누락이 잦으면 → **STEP 7**(개선안) 검토

## STEP 6 — 환경변수 확인 (cron 미등록일 때)

1. Render 서비스 → **Environment** 탭
2. `SCRAPER_CRON_ENABLED`가 `false`면 삭제하거나 `true`로
3. `SCRAPER_CRON`이 있으면 `0 * * * *`인지 확인 (없으면 기본값으로 동작)
4. Save → 재배포 후 **STEP 4** 다시

## STEP 7 — (선택) 정각 보장 개선안

Free 플랜 구조상 정각 누락은 정상 범위. 100% 보장이 필요하면:

- Render Starter($7/월) 업그레이드, 또는
- cron-job.org(무료)가 매시 `POST https://<URL>/api/scraper/run`
  (헤더 `Authorization: Bearer <SCRAPER_ADMIN_TOKEN>`)을 직접 호출하도록 설정
  → in-process cron 의존을 없앰

---

## 빠른 판정 요약

| 관찰 | 결론 |
|---|---|
| 로그에 매시 `triggered reason:"cron"` + `Scraper finished` 반복 | ✅ 정상 |
| `cron scheduled`만 있고 `triggered cron` 없음 | 서버가 정각마다 sleep → STEP 5 |
| `cron scheduled`도 없음 | cron 비활성 → STEP 6 |
| `/health` uptimeSec가 늘 작음 | 프로세스가 안 떠 있음 → STEP 5 |

1차 점검은 **STEP 1(health)** + **STEP 4(로그)** 조합을 권장.
