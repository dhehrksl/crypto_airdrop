// Reddit 공개 JSON API — r/airdrops 등에서 7일치 게시글 수집.
// 무인증 무료. User-Agent만 갖추면 됨. Rate limit: 60 RPM IP당.
// ToS: 공개 콘텐츠의 개인적/연구 목적 조회는 허용. 본 앱은 휴먼 큐레이션을 거쳐
// 원문 republishing이 아닌 구조 추출만 사용 — derivative works 회색 영역 회피.

const axios = require('axios');

const REDDIT_USER_AGENT = 'crypto_airdrop_curator/1.0 (curation pipeline; human-reviewed)';

// 기본 서브레딧 목록 — env로 override 가능
const DEFAULT_SUBREDDITS = (
  process.env.REDDIT_SUBREDDITS || 'airdrops,CryptoAirdrops,CryptoMoonShots'
).split(',').map((s) => s.trim()).filter(Boolean);

const LOOKBACK_DAYS = 7;
const PER_SUBREDDIT_LIMIT = 100; // Reddit JSON 한 페이지 상한 ≈ 100

// 빠른 필터 — 본문/제목에 에어드랍 관련 키워드가 없으면 AI 호출 전 스킵
const KEYWORD_REGEX =
  /\b(airdrop|airdropped|claim|claimable|testnet|points\s+program|incentive|allocation|distribute|distribution|retroactive|TGE|token\s+launch|whitelist|presale|quest)\b/i;

async function fetchSubreddit(name) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/new.json?limit=${PER_SUBREDDIT_LIMIT}`;
  try {
    const r = await axios.get(url, {
      timeout: 20000,
      headers: { 'User-Agent': REDDIT_USER_AGENT, Accept: 'application/json' },
    });
    const children = r?.data?.data?.children;
    return Array.isArray(children) ? children : [];
  } catch (e) {
    console.warn(`[Reddit] r/${name} fetch failed: ${e.message || e}`);
    return [];
  }
}

function isWithinLookback(epochSec) {
  if (!epochSec) return false;
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return epochSec * 1000 >= cutoff;
}

// 출력 형태는 scraper 모듈의 raw item과 동일 — 동일 파이프라인에서 처리 가능
async function fetchRedditAirdrops({ subreddits = DEFAULT_SUBREDDITS } = {}) {
  const all = [];
  for (const sub of subreddits) {
    const children = await fetchSubreddit(sub);
    for (const c of children) {
      const p = c?.data;
      if (!p || p.stickied) continue;
      if (!isWithinLookback(p.created_utc)) continue;
      const haystack = `${p.title || ''}\n${p.selftext || ''}`;
      if (!KEYWORD_REGEX.test(haystack)) continue;

      const link = p.permalink ? `https://www.reddit.com${p.permalink}` : (p.url || '');
      const id = `reddit:${p.id}`;
      all.push({
        id,
        title: (p.title || '').trim(),
        content: (p.selftext || '').slice(0, 2000),
        link,
        sourceName: `Reddit-r/${sub}`,
        score: p.score || 0,
        num_comments: p.num_comments || 0,
        author: p.author,
        created_utc: p.created_utc,
      });
    }
  }
  console.log(
    `[Reddit] collected ${all.length} airdrop-related posts from ${subreddits.length} subreddits (last ${LOOKBACK_DAYS} days)`
  );
  return all;
}

module.exports = { fetchRedditAirdrops, DEFAULT_SUBREDDITS, LOOKBACK_DAYS };
