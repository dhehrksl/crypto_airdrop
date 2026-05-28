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

// 10. RETROSPECTIVE_TITLE — 가격 등락 회고 기사 (실제 잡혔던 사례)
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'ETHFI Value Drops By 35%' },
    { title: 'ETHFI Value Drops By 35% After The Airdrop', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'RETROSPECTIVE: "ETHFI Value Drops" → demote'
  );
}

// 11. RETROSPECTIVE_TITLE — 시총 surge
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'Wormhole Market Cap Surges After Token Launch', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'RETROSPECTIVE: "Market Cap Surges" → demote'
  );
}

// 12. RETROSPECTIVE_TITLE — 가격 plunge
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'Arbitrum Price Plunges 20% in 24h', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'RETROSPECTIVE: "Price Plunges" → demote'
  );
}

// 13. POST_EVENT_TITLE — "after the airdrop"
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'What Happens After the Airdrop?', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'POST_EVENT: "after the airdrop" → demote'
  );
}

// 14. POST_EVENT_TITLE — "post-airdrop"
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'Post-Airdrop Market Analysis', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'POST_EVENT: "post-airdrop" → demote'
  );
}

// 15. POST_EVENT_TITLE — "market turbulence"
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'Market Turbulence Hits New Tokens', content: '' }
  );
  expect(
    r.demote === true && r.reason === 'retrospective_price_news',
    'POST_EVENT: "market turbulence" → demote'
  );
}

// 16. RETROSPECTIVE 패턴 흉내내지만 정상 — 가격 단어 없음
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'New Airdrop Campaign Launches Today', content: '' }
  );
  expect(r.demote === false, '정상 캠페인 제목 → 통과 (false positive 없음)');
}

// 17. 본문에 가격 등락 있어도 제목 깨끗하면 통과 (본문 기반 매치 안 함)
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: null, title: 'X' },
    { title: 'How to Participate in Pendle Campaign', content: 'PENDLE price dropped 10% last week' }
  );
  expect(r.demote === false, '제목 깨끗 + 본문에 가격 언급 → 통과');
}

// 18. end_date 미래라도 RETROSPECTIVE 제목이면? 우선순위 확인.
//     현재 구현: end_date 미래면 그대로 통과 (retrospective 검사 안 함).
//     의도된 동작 — end_date 검사가 최우선.
{
  const r = shouldDemoteAirdrop(
    { is_airdrop: true, end_date: future, title: 'X' },
    { title: 'ETH Price Drops After New Airdrop', content: '' }
  );
  expect(
    r.demote === false,
    'end_date 미래 + RETROSPECTIVE 제목 → 통과 (end_date 우선, 의도된 동작)'
  );
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
