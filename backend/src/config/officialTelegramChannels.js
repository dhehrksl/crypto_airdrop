// 자동 승인 대상 Telegram 공식 채널 화이트리스트.
//
// 여기에 등록된 채널에서 수집된 draft는 admin 검수 없이 자동으로 Airdrop 컬렉션에
// 승격된다 (status=approved + is_confirmed=true). 잘못 등록하면 잘못된 정보가 사용자
// 화면에 바로 노출되므로 **프로젝트 재단/팀이 직접 운영하는 1차 출처만** 등록한다.
//
// 검증 기준:
//   - 채널 설명에 "Official" 표기 + 프로젝트 공식 도메인 링크
//   - 팔로워 수십만+ + 인증 마크 (가능한 경우)
//   - aggregator/뉴스 채널은 X
//
// 채널명은 소문자로 비교한다 (Telegram username은 case-insensitive).

const OFFICIAL_TG_CHANNELS = new Set(
  [
    // === TON 생태계 (재단 운영) ===
    'toncoin', 'ton_blockchain', 'tonsociety', 'tonstatus',
    'tapps_center', 'theopennetwork', 'tonkeeper_news', 'tonkeeper',

    // === Layer 1 / Layer 2 공식 ===
    'arbitrum', 'arbitrum_news', 'optimismfnd', 'celestiaorg',
    'berachain', 'monad_xyz', 'hyperliquid_official', 'megaeth_labs',
    'movementlabsxyz', 'aptos_network', 'suinetwork',
    'eigenlayer', 'polygon', 'zksync', 'scroll_official', 'linea_build',
    'starknet_intern',

    // === DeFi 공식 ===
    'uniswap', 'aaveofficial', 'makerdao', 'compoundfinance',
    'lidofinance', 'pendle_finance', '1inchnetwork', 'jito_labs', 'jup_ag',

    // === 거래소 공식 (한정) — Binance/Coinbase 등 가끔 공식 캠페인 발표 ===
    // 거래소는 광고/이벤트가 많아 conservatively 등록 안 함.
  ].map((s) => s.toLowerCase())
);

// 입력은 telegramSource.js가 만든 sourceName (예: "Telegram-@toncoin")
// 또는 채널명 자체 ("toncoin"). 둘 다 처리.
function isOfficialTelegramSource(sourceName) {
  if (!sourceName) return false;
  const m = String(sourceName).match(/(?:Telegram-)?@?([A-Za-z0-9_]+)/);
  if (!m) return false;
  return OFFICIAL_TG_CHANNELS.has(m[1].toLowerCase());
}

module.exports = { OFFICIAL_TG_CHANNELS, isOfficialTelegramSource };
