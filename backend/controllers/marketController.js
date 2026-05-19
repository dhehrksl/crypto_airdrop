const axios = require('axios');
const logger = require('../src/lib/logger');

// CoinGecko simple/price는 ticker가 아닌 coin ID를 요구한다 ("USDT" X, "tether" O).
// 자주 등장하는 토큰만 정적 매핑 — 매번 /search 호출은 quota 낭비.
// 매핑 누락이면 한 번 /search로 시도하고 결과 캐싱.
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// 스테이블코인 — 어차피 1 USD 고정. API 호출 안 함.
const STABLECOINS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDP', 'LUSD', 'GUSD', 'FDUSD', 'USDe', 'PYUSD']);

// 자주 등장하는 ticker → CoinGecko id 매핑 (대문자 키)
const TICKER_TO_ID = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple',
  ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot', TRX: 'tron', MATIC: 'matic-network',
  POL: 'matic-network', LINK: 'chainlink', UNI: 'uniswap', LTC: 'litecoin', ATOM: 'cosmos',
  ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', APT: 'aptos', NEAR: 'near',
  TIA: 'celestia', SEI: 'sei-network', INJ: 'injective-protocol', RUNE: 'thorchain',
  JUP: 'jupiter-exchange-solana', PYTH: 'pyth-network', JTO: 'jito-governance-token',
  ENA: 'ethena', PENDLE: 'pendle', LDO: 'lido-dao', RPL: 'rocket-pool',
  AAVE: 'aave', COMP: 'compound-governance-token', MKR: 'maker', SNX: 'havven',
  CRV: 'curve-dao-token', CVX: 'convex-finance', FXS: 'frax-share', SUSHI: 'sushi',
  ETHFI: 'ether-fi', EIGEN: 'eigenlayer', KMNO: 'kamino', W: 'wormhole', WLD: 'worldcoin',
  STRK: 'starknet', ZRO: 'layerzero', ZK: 'zksync', BLUR: 'blur', FRIEND: 'friend-tech',
  DOGE: 'dogecoin', SHIB: 'shiba-inu', PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
};

// 메모리 캐시 — 같은 ticker를 짧은 시간 내 여러 번 조회할 때 CoinGecko 호출 절감
const idCache = new Map(); // tickerUpper -> { id, expiry }
const priceCache = new Map(); // id -> { data, expiry }
const ID_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PRICE_TTL_MS = 5 * 60 * 1000;    // 5분

function now() { return Date.now(); }

function readCache(map, key) {
  const e = map.get(key);
  if (e && e.expiry > now()) return e;
  if (e) map.delete(key);
  return null;
}

async function resolveCoinId(tickerUpper) {
  if (TICKER_TO_ID[tickerUpper]) return TICKER_TO_ID[tickerUpper];
  const cached = readCache(idCache, tickerUpper);
  if (cached) return cached.id;
  // /search?query=<symbol>로 동적 매핑 시도
  try {
    const r = await axios.get(`${COINGECKO_API_BASE}/search`, {
      params: { query: tickerUpper },
      timeout: 8000,
    });
    const coins = r?.data?.coins;
    if (Array.isArray(coins) && coins.length > 0) {
      // symbol이 정확히 일치하는 코인 우선 (market cap 정렬은 응답 순서)
      const exact = coins.find((c) => (c.symbol || '').toUpperCase() === tickerUpper);
      const id = (exact || coins[0]).id;
      idCache.set(tickerUpper, { id, expiry: now() + ID_TTL_MS });
      return id;
    }
  } catch (e) {
    logger.warn({ err: e, ticker: tickerUpper }, '[Market] search failed');
  }
  // 매핑 실패 — 24시간 동안 재시도 안 함
  idCache.set(tickerUpper, { id: null, expiry: now() + ID_TTL_MS });
  return null;
}

const getPriceData = async (req, res) => {
  const { coinId, vsCurrency = 'usd', include24hrChange = 'true' } = req.query;
  if (!coinId) return res.status(400).json({ msg: 'coinId is required' });

  const tickerUpper = String(coinId).toUpperCase();

  // 스테이블코인 — 외부 호출 없이 즉시 응답
  if (STABLECOINS.has(tickerUpper)) {
    return res.json({ [vsCurrency]: 1.0, [`${vsCurrency}_24h_change`]: 0 });
  }

  const id = await resolveCoinId(tickerUpper);
  if (!id) {
    // 알 수 없는 ticker — 404 대신 200 + null 데이터로 처리해 클라이언트 에러 로그 안 남기게
    return res.json({ unsupported: true, ticker: tickerUpper });
  }

  // 가격 캐시
  const cached = readCache(priceCache, `${id}|${vsCurrency}`);
  if (cached) return res.json(cached.data);

  try {
    const response = await axios.get(`${COINGECKO_API_BASE}/simple/price`, {
      params: { ids: id, vs_currencies: vsCurrency, include_24hr_change: include24hrChange },
      timeout: 8000,
    });
    if (response.data && response.data[id]) {
      priceCache.set(`${id}|${vsCurrency}`, { data: response.data[id], expiry: now() + PRICE_TTL_MS });
      return res.json(response.data[id]);
    }
    return res.json({ unsupported: true, ticker: tickerUpper });
  } catch (error) {
    logger.error({ err: error }, '[Market] CoinGecko fetch failed');
    return res.status(502).json({ msg: 'External API error' });
  }
};

module.exports = { getPriceData };
