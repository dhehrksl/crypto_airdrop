// 차단된 출처 목록 (single source of truth)
// 새 출처 추가 시 차단 사유 + 인지 날짜를 반드시 한 줄 주석으로 남길 것.
//
// 이 모듈은 ingestion 가드(scraper), 관리자 입력 가드(controller),
// Mongoose validator 세 곳에서 모두 import 된다.

const BLOCKED_HOSTS = [
  // ToS: "Non-commercial personal use only" — 광고 수익 모델 앱과 충돌. 2026-05-17 차단.
  'airdrops.io',
];

const BLOCKED_SOURCE_NAMES = [
  // 같은 사유로 sourceName 진입도 차단
  'airdrops.io',
];

function normalizeHost(host) {
  if (!host) return '';
  return String(host).toLowerCase().replace(/^www\./, '');
}

function extractHost(urlString) {
  if (!urlString || typeof urlString !== 'string') return '';
  try {
    return normalizeHost(new URL(urlString).hostname);
  } catch (_e) {
    return '';
  }
}

function matchHost(urlString) {
  const host = extractHost(urlString);
  if (!host) return null;
  for (const blocked of BLOCKED_HOSTS) {
    const b = normalizeHost(blocked);
    if (host === b || host.endsWith('.' + b)) return blocked;
  }
  return null;
}

function matchSourceName(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  for (const blocked of BLOCKED_SOURCE_NAMES) {
    if (n === String(blocked).toLowerCase()) return blocked;
  }
  return null;
}

// 단일 항목 검사. link / sourceName / sources(배열) 어느 것이든 매치되면 차단.
function isBlockedSource({ link, sourceName, sources } = {}) {
  const hostHit = matchHost(link);
  if (hostHit) return { blocked: true, reason: 'host', matched: hostHit };

  const nameHit = matchSourceName(sourceName);
  if (nameHit) return { blocked: true, reason: 'sourceName', matched: nameHit };

  if (Array.isArray(sources)) {
    for (const s of sources) {
      const hit = matchSourceName(s);
      if (hit) return { blocked: true, reason: 'sourceArray', matched: hit };
    }
  }
  return { blocked: false };
}

module.exports = {
  BLOCKED_HOSTS,
  BLOCKED_SOURCE_NAMES,
  matchHost,
  matchSourceName,
  isBlockedSource,
};
