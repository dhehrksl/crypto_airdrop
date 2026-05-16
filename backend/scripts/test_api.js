// /api/scraper/run 핸들러의 락/쿨다운/응답 자동 검증 스크립트
// 사용법: 다른 터미널에서 `npm start`로 서버를 띄운 뒤, `npm run test:api`
//
// MongoDB나 Gemini 키가 없어도 핸들러 동작은 검증됩니다.
// (백그라운드 작업이 DB 연결 실패로 죽어도 finally가 락을 풀어주는 것까지 확인)

const http = require('http');

const HOST = process.env.TEST_HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;
const ENDPOINT = '/api/scraper/run';
const TOKEN = process.env.SCRAPER_ADMIN_TOKEN || '';

function post() {
  return new Promise((resolve, reject) => {
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
    const req = http.request(
      { host: HOST, port: PORT, path: ENDPOINT, method: 'POST', headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            retryAfter: res.headers['retry-after'] || null,
            body: body.trim(),
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmt(r) {
  return `status=${r.status}${r.retryAfter ? ` retry-after=${r.retryAfter}` : ''} body=${r.body}`;
}

function pass(label) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${label}`);
}
function fail(label, detail) {
  console.log(`\x1b[31m[FAIL]\x1b[0m ${label} — ${detail}`);
  process.exitCode = 1;
}

async function main() {
  console.log(`▶ 대상: http://${HOST}:${PORT}${ENDPOINT}\n`);

  // 사전 헬스체크
  try {
    await post();
  } catch (e) {
    console.error(`\x1b[31m서버 연결 실패:\x1b[0m ${e.message}`);
    console.error(`먼저 다른 터미널에서 \`npm start\`로 서버를 띄워주세요.`);
    process.exit(2);
  }

  // 위 호출이 이미 1차 호출이 되어버렸으므로 쿨다운 풀릴 때까지 기다리는 대신
  // 깔끔한 시퀀스를 보장하기 위해 짧은 안내 후 재시작 권장
  console.log('※ 위 사전 헬스체크가 이미 1회 호출로 잡혀 쿨다운이 활성화된 상태일 수 있습니다.');
  console.log('   정확한 시퀀스 검증을 원하면 서버를 재시작 후 다시 실행하세요.\n');

  console.log('── 1차 호출 (락 잡힘 기대) ──');
  const r1 = await post();
  console.log(fmt(r1));
  if (r1.status === 200) pass('1차 호출 200 OK');
  else if (r1.status === 429) {
    console.log('   → 이전 호출의 쿨다운이 살아있습니다. 서버 재시작 후 다시 시도해주세요.');
    process.exit(0);
  } else fail('1차 호출', `예상 200, 실제 ${r1.status}`);

  await sleep(200);

  console.log('\n── 2차 호출 (락 활성, 409 Conflict 기대) ──');
  const r2 = await post();
  console.log(fmt(r2));
  if (r2.status === 409) pass('동시 실행 락 작동');
  else fail('락 검증', `예상 409, 실제 ${r2.status}`);

  // 백그라운드 작업이 끝날 때까지 잠깐 폴링 (DB 없으면 ~10초 안에 timeout으로 실패)
  console.log('\n── 백그라운드 scraper 종료 대기 (최대 60초) ──');
  let released = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const r = await post();
    if (r.status !== 409) {
      released = true;
      console.log(`락 해제 확인 (${fmt(r)})`);
      if (r.status === 429) pass('락 해제 후 쿨다운 활성 (Retry-After 헤더 존재 시 정상)');
      else fail('쿨다운 검증', `예상 429, 실제 ${r.status}`);
      break;
    }
  }
  if (!released) fail('락 해제 검증', '60초 내에 락이 해제되지 않음');

  console.log('\n검증 완료. 실제 AI 호출 통계를 보려면 서버 로그의 다음 줄을 확인하세요:');
  console.log('  --- Finished --- (items=N, ai=X, heuristic=Y, skipped=Z)');
  console.log('ai 값이 items 대비 현저히 작으면 사전 필터가 잘 작동하는 것입니다.');
}

main().catch((e) => {
  console.error('테스트 실행 중 오류:', e);
  process.exit(1);
});
