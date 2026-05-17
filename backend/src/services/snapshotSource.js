// Snapshot.org (MIT 라이선스 오픈소스) GraphQL Hub API에서
// 활성(open for voting) 상태의 거버넌스 proposal 중 에어드랍/토큰 분배 관련만 가져온다.
//
// 데이터는 IPFS에 content-addressed로 공개 저장되어 있어 commercial 사용 OK.
// 라이선스/ToS: https://github.com/snapshot-labs (MIT)
// API 한도: 무료 60 RPM (API key 없이 호출 가능)

const axios = require('axios');

const SNAPSHOT_GRAPHQL = 'https://hub.snapshot.org/graphql';

// 활성 proposal 본문/제목에 매치할 에어드랍/분배 키워드.
// title/body 중 어느 곳이든 매치되면 ingestion 후보로 채택.
const AIRDROP_KEYWORDS_REGEX =
  /\b(airdrop|airdropped|air\s+drop|distribute|distribution|allocate|allocation|retroactive|reward(s)?\s+program|incentive(s)?\s+program|points\s+program|token\s+launch|tge|claim\s+(window|period))\b/i;

async function fetchSnapshotProposals({ limit = 100 } = {}) {
  const query = `
    query GetActiveProposals {
      proposals(
        first: ${limit}
        where: { state: "active" }
        orderBy: "created"
        orderDirection: desc
      ) {
        id
        title
        body
        link
        end
        space { id name }
      }
    }
  `;

  let proposals;
  try {
    const r = await axios.post(
      SNAPSHOT_GRAPHQL,
      { query },
      { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
    );
    proposals = r.data && r.data.data && r.data.data.proposals;
    if (!Array.isArray(proposals)) return [];
  } catch (e) {
    console.warn(`[Snapshot] fetch failed: ${e.message || e}`);
    return [];
  }

  const matches = proposals.filter((p) => {
    const haystack = `${p.title || ''}\n${p.body || ''}`;
    return AIRDROP_KEYWORDS_REGEX.test(haystack);
  });

  return matches.map((p) => {
    const spaceLabel = (p.space && (p.space.name || p.space.id)) || 'DAO';
    return {
      id: 'snapshot:' + p.id,
      title: `[${spaceLabel}] ${p.title || '(제목 없음)'}`,
      content: (p.body || '').slice(0, 1500),
      link:
        p.link ||
        (p.space && p.space.id ? `https://snapshot.org/#/${p.space.id}/proposal/${p.id}` : 'https://snapshot.org'),
      sourceName: `Snapshot-${spaceLabel}`,
    };
  });
}

module.exports = { fetchSnapshotProposals, AIRDROP_KEYWORDS_REGEX };
