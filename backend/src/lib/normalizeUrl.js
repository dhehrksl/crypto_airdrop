// 같은 기사가 다른 URL 형태로 여러 출처에서 들어올 때 dedup 키로 쓰기 위한 정규화.
// 예) https://www.example.com/post/?utm_source=x  ≡  http://example.com/post
// 보수적으로 동작 — 의미가 달라질 수 있는 변환(쿼리 전부 제거, 대소문자 path 변경 등)은 하지 않는다.

const TRACKING_PARAM_PREFIXES = ['utm_'];
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
  'ref', 'ref_src', 'referrer', 'source',
  'igshid', 'yclid', '_ga', '_gl',
]);

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);

    // 1) 프로토콜은 http/https만 받음. 그 외(mailto, javascript, t.me URL 등)는 정규화하지 않음.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw;

    // 2) http → https (대다수 사이트가 redirect)
    u.protocol = 'https:';

    // 3) hostname 소문자 + www. 제거
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');

    // 4) 트래킹 쿼리 제거 (의미 있는 쿼리는 보존)
    const keep = [];
    for (const [k, v] of u.searchParams.entries()) {
      const kl = k.toLowerCase();
      if (TRACKING_PARAMS.has(kl)) continue;
      if (TRACKING_PARAM_PREFIXES.some((p) => kl.startsWith(p))) continue;
      keep.push([k, v]);
    }
    u.search = '';
    for (const [k, v] of keep) u.searchParams.append(k, v);

    // 5) fragment(#...) 제거
    u.hash = '';

    // 6) trailing slash 제거 (단, root path "/"는 유지)
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);

    return s;
  } catch (e) {
    return raw;
  }
}

module.exports = { normalizeUrl };
