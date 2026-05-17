// Telegram 공개 채널 — t.me/s/<channel> 미리보기 HTML을 파싱해 최근 게시글 수집.
// MTProto 인증 없이 동작 (공개 채널만). 채널 운영자가 "Preview channel" 비활성화하면 빈 결과.
// 환경변수 TELEGRAM_CHANNELS에 쉼표 구분으로 채널명 등록 (예: "airdropalert,CoinAirdrops_News").
// MVP — 사용자가 직접 좋은 채널 등록하는 형태. 향후 MTProto 클라이언트로 확장 가능.

const axios = require('axios');
const cheerio = require('cheerio');

const TELEGRAM_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_CHANNELS = (process.env.TELEGRAM_CHANNELS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LOOKBACK_DAYS = 7;

const KEYWORD_REGEX =
  /\b(airdrop|claim|claimable|testnet|points|incentive|allocation|distribute|retroactive|TGE|token\s+launch|whitelist|presale|quest)\b/i;

async function fetchChannel(name) {
  const url = `https://t.me/s/${encodeURIComponent(name)}`;
  try {
    const r = await axios.get(url, {
      timeout: 20000,
      headers: { 'User-Agent': TELEGRAM_USER_AGENT, Accept: 'text/html' },
    });
    return r.data || '';
  } catch (e) {
    console.warn(`[Telegram] @${name} fetch failed: ${e.message || e}`);
    return '';
  }
}

function parsePosts(html, channelName) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const out = [];
  $('.tgme_widget_message_wrap').each((_, el) => {
    const $el = $(el);
    const text = $el.find('.tgme_widget_message_text').text().trim();
    if (!text) return;
    const datetime = $el.find('time.time, time').attr('datetime');
    const ts = datetime ? Date.parse(datetime) : NaN;
    if (!Number.isFinite(ts) || ts < cutoff) return;
    const link = $el.find('a.tgme_widget_message_date').attr('href') || '';
    // 메시지 ID — link 마지막 슬래시 뒤 (예: ..../12345)
    const msgId = (link.match(/\/(\d+)(?:[?#]|$)/) || [])[1] || '';
    if (!KEYWORD_REGEX.test(text)) return;
    out.push({
      id: `telegram:${channelName}:${msgId}`,
      // Telegram 게시글은 별도 title이 없으므로 첫 줄을 제목으로 사용
      title: (text.split('\n').find((l) => l.trim()) || '').slice(0, 200).trim(),
      content: text.slice(0, 2000),
      link,
      sourceName: `Telegram-@${channelName}`,
      created_utc: Math.floor(ts / 1000),
    });
  });
  return out;
}

async function fetchTelegramAirdrops({ channels = DEFAULT_CHANNELS } = {}) {
  if (channels.length === 0) {
    console.log('[Telegram] no channels configured — set TELEGRAM_CHANNELS env to enable');
    return [];
  }
  const all = [];
  for (const ch of channels) {
    const html = await fetchChannel(ch);
    const posts = parsePosts(html, ch);
    all.push(...posts);
  }
  console.log(`[Telegram] collected ${all.length} airdrop-related posts from ${channels.length} channels`);
  return all;
}

module.exports = { fetchTelegramAirdrops, DEFAULT_CHANNELS };
