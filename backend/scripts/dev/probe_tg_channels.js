// 후보 Telegram 채널의 t.me/s/<name> 미리보기 활성 여부 빠르게 확인.
// 사용: node scripts/dev/probe_tg_channels.js
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const candidates = [
  // 이미 등록된 것 — 검증용
  'airdropalert', 'airdrops_official', 'AirdropDetective', 'CryptoAirdropsAlert', 'CoinAirdropsNews',
  'airdrop_inspector', 'earnathonn', 'defi_airdrops',
  // 신규 후보
  'airdrops_crypto', 'AirdropsLive', 'airdropfind', 'cryptoairdropfree', 'AirdropHunter', 'AirdropWorld',
  'realairdrops', 'AirdropsForAll', 'newcryptoairdrops', 'top_airdrops', 'TokenAirdrops', 'airdropstreet',
  'CryptoAirdropWorld', 'daily_airdrop', 'airdroping', 'Crypto_Airdrops_Free', 'airdroptracker', 'airdropmagnet',
  'airdropbots', 'GemDrops', 'airdropdaily_official', 'cryptobounty', 'airdropcoinlist',
  'Cryptos_Airdrops', 'AirdropOfficial', 'crypto_airdrop_official', 'airdrop_aggregator',
];

(async () => {
  const live = [];
  const dead = [];
  for (const c of candidates) {
    try {
      const r = await axios.get('https://t.me/s/' + encodeURIComponent(c), {
        timeout: 8000,
        headers: { 'User-Agent': UA },
        maxRedirects: 5,
      });
      const $ = cheerio.load(r.data || '');
      const count = $('.tgme_widget_message_wrap').length;
      if (count > 0) {
        live.push({ name: c, messages: count });
      } else {
        dead.push({ name: c, reason: 'no-preview' });
      }
    } catch (e) {
      dead.push({ name: c, reason: e.code || e.message });
    }
  }
  console.log('=== LIVE (' + live.length + ') ===');
  live.sort((a, b) => b.messages - a.messages).forEach((l) =>
    console.log('  OK', l.name, '—', l.messages, 'msgs visible')
  );
  console.log('=== DEAD (' + dead.length + ') ===');
  dead.forEach((d) => console.log('  NO', d.name, '—', d.reason));
})();
