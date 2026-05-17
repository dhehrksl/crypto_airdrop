// shouldDemoteAirdrop() 사후 검증 로직 단위 테스트 (수동 실행).
//
// AI 응답이 실제 Gemini를 거치지 않고 직접 가짜 객체로 함수에 주입된다.
// DB 접근 없음.
//
// 실행: node scripts/dev/verify_ai_post_check.js

const { shouldDemoteAirdrop } = require('../../src/services/scraper');

let passed = 0;
let failed = 0;

function expect(cond, name, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name} — ${detail || ''}`);
    failed++;
  }
}

const now = new Date();
const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();      // 30일 전
const justBarelyPast = new Date(now.getTime() - 30 * 60 * 1000).toISOString();      // 30분 전 (grace 1h 안)
const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();    // 30일 후

console.log('\nshouldDemoteAirdrop()');

// 1. end_date가 과거 (30일 전) → demote
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: past, title: 'X' },
    { title: '', content: '' }
  );
  expect(r.demote === true && r.reason === 'past_end_date', 'end_date 30일 전 → demote');
}

// 2. end_date가 미래 → 통과
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: future, title: 'Y' },
    { title: '', content: '' }
  );
  expect(r.demote === false, 'end_date 30일 후 → 통과');
}

// 3. end_date가 30분 전 (grace 1h 안) → 통과 (시각 오차 허용)
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: justBarelyPast, title: 'Z' },
    { title: '', content: '' }
  );
  expect(r.demote === false, 'end_date 30분 전 (grace 안) → 통과');
}

// 4. is_airdrop=false면 검사 안 함
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: false, end_date: past, title: 'N' },
    { title: '', content: '' }
  );
  expect(r.demote === false, 'is_airdrop=false → 검사 스킵');
}

// 5. end_date 누락 + 본문에 종결 키워드 → demote
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'A' },
    { title: 'X token', content: 'The airdrop has ended last week.' }
  );
  expect(
    r.demote === true && r.reason === 'ended_keyword_in_body',
    'end_date null + "airdrop has ended" → demote'
  );
}

// 6. end_date 누락 + 다른 종결 키워드
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'B' },
    { title: '', content: 'Distribution is complete and the claim period closed.' }
  );
  expect(
    r.demote === true && r.reason === 'ended_keyword_in_body',
    'end_date null + "distribution complete" → demote'
  );
}

// 7. end_date 누락 + 종결 키워드 없음 → 통과
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'C' },
    { title: 'Upcoming airdrop', content: 'Connect your wallet to participate.' }
  );
  expect(r.demote === false, 'end_date null + 종결 키워드 없음 → 통과');
}

// 8. end_date 파싱 실패 (잘못된 형식) → 본문 키워드 검사로 fallback
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: 'not-a-date', title: 'D' },
    { title: '', content: 'The airdrop has ended.' }
  );
  expect(r.demote === true, '파싱 실패 시 본문 키워드 검사로 fallback');
}

// 9. aiResult가 null → 통과
{
  const r = shouldDemoteAirdrop(null, { title: '', content: '' });
  expect(r.demote === false, 'aiResult null → 통과');
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
