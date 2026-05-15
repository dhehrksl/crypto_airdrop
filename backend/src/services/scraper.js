const axios = require('axios');
const RSSParser = require('rss-parser');

const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');
const User = require('../../models/User');
const { Expo } = require('expo-server-sdk');

const parser = new RSSParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const RSS_SOURCES = [
  // Existing Sources
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss/tag/airdrop' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Medium-Airdrop', url: 'https://medium.com/feed/tag/airdrop' },
  { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { name: 'NewsBTC', url: 'https://www.newsbtc.com/tag/airdrop/feed/' },
  { name: 'TokenPost', url: 'https://tokenpost.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed/' },

  // Newly Added Sources
  { name: 'The Block', url: 'https://theblock.co/rss.xml' },
  { name: 'Bitcoin.com News', url: 'https://news.bitcoin.com/feed' },
  { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed' },
  { name: 'CryptoPanic', url: 'https://cryptopanic.com/news/rss' },
  { name: 'U.Today', url: 'https://u.today/rss' },
  { name: 'Bitcoinist', url: 'https://bitcoinist.com/feed' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed/' },
  { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed' },
  { name: 'Forbes Crypto', url: 'https://www.forbes.com/digital-assets/feed/' }
];

const POSITIVE_PATTERNS = [
  /airdrop/i, /claim/i, /snapshot/i, /eligib/i, /testnet/i, /mainnet/i, 
  /incentivized/i, /waitlist/i, /points/i, /reward/i, /quest/i, /whitelist/i
];

const NEGATIVE_PATTERNS = [
  /lawsuit/i, /sec/i, /regulation/i, /court/i, /sue/i, /price prediction/i, 
  /market analysis/i, /etf/i, /scandal/i, /hack/i, /exploit/i, /stolen/i, 
  /whale/i, /horoscope/i, /bankruptcy/i, /vc/i, /funding/i, /investment/i
];

async function fetchRealData() {
  let allItems = [];
  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, 2).map(item => ({ 
        id: String(item.guid || item.link), // Added String() conversion for Mongoose CastError fix
        title: item.title,
        content: item.contentSnippet || item.content || "",
        link: item.link,
        sourceName: source.name
      }));
      allItems = [...allItems, ...items];
    } catch (error) {
      const reason = error.status ? `Status ${error.status}` : "Fetch/Parse Error";
      console.warn(`[Skip Source] ${source.name}: ${reason}`);
    }
  }
  return Array.from(new Map(allItems.map(item => [item.id, item])).values());
}

function evaluateNews(item) {
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  if (NEGATIVE_PATTERNS.some(p => p.test(title))) return { skip: true, reason: 'noise in title' };
  let score = 0;
  POSITIVE_PATTERNS.forEach(p => {
    if (p.test(title)) score += 10;
    if (p.test(content)) score += 2;
  });
  if (/airdrop|claim|snapshot|testnet/i.test(title)) score += 20;
  return { skip: false, score, reason: 'ok' }; 
}

async function sendPushNotifications(airdrop) {
  const users = await User.find({ push_token: { $exists: true, $ne: null } });
  if (users.length === 0) return;
  const messages = users.filter(u => Expo.isExpoPushToken(u.push_token)).map(u => ({
    to: u.push_token,
    sound: 'default',
    title: '🚀 새로운 고신뢰 에어드랍!',
    body: `[${airdrop.title}] 지금 확인해보세요.`,
    data: { airdropId: airdrop._id },
  }));
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try { await expo.sendPushNotificationsAsync(chunk); } catch (e) { console.error(e); }
  }
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Use the only working model for this API key

async function runScraper() {
  console.log('--- Starting Scraper ---');
  const rawItems = await fetchRealData();
  for (const item of rawItems) {
    // Mongoose CastError fix: Use $eq to explicitly match string values for unique_hash
    const existingAirdrop = await Airdrop.findOne({ unique_hash: { $eq: item.id } });
    const existingNews = await News.findOne({ unique_hash: { $eq: item.id } });
    if (existingAirdrop || existingNews) continue;
    
    const PROMPT = `
      You are an expert in cryptocurrency airdrops. Analyze the following article content and determine if it's an airdrop announcement/guide or general crypto news.
      If it's an airdrop, also determine if it's a potential scam.
      Extract key information and summarize the content. The response MUST be a JSON object.

      Article Title: "${item.title}"
      Article Content: "${item.content}"
      Article Link: "${item.link}"

      Your JSON response MUST have the following structure:
      {
        "is_airdrop": boolean, // true if it's an airdrop, false if it's general news
        "is_scam": boolean,    // true if it appears to be a scam (e.g., asks for private keys, direct deposits, suspicious links)
        "title": "string",     // Extracted or summarized title of the airdrop/news
        "description": "string", // A 3-sentence summary of the airdrop participation steps or news content
        "trust_score": number, // A score from 0 to 100 indicating the trustworthiness/relevance (higher is better, 0 for clear scam)
        "official_link": "string", // The most relevant official link for participation or source. Use Article Link if no other official link is found.
        "end_date": "YYYY-MM-DDTHH:MM:SSZ" or null // Airdrop end date in ISO 8601 format, or null if not applicable/found
      }

      Example for airdrop:
      {
        "is_airdrop": true,
        "is_scam": false,
        "title": "XYZ Protocol Airdrop - How to Claim",
        "description": "Participate by interacting with the XYZ dApp. Connect your wallet and perform a swap. Claim tokens on the official website before 2024-12-31.",
        "trust_score": 90,
        "official_link": "https://xyzprotocol.com/airdrop",
        "end_date": "2024-12-31T23:59:59Z"
      }

      Example for news:
      {
        "is_airdrop": false,
        "is_scam": false,
        "title": "Bitcoin Price Reaches New All-Time High",
        "description": "Bitcoin surged past $70,000 this week. Analysts attribute the rally to institutional adoption. Future outlook remains positive.",
        "trust_score": 85,
        "official_link": "https://coindesk.com/bitcoin-news",
        "end_date": null
      }
      `;

    let aiResult;
    try {
      const result = await model.generateContent(PROMPT, { responseMimeType: "application/json" });
      const response = await result.response;
      let rawText = response.text();
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      aiResult = JSON.parse(rawText);
      await sleep(5000); // Add a 5 second delay to avoid rate limits
    } catch (error) {
      console.error('Gemini API Error:', error);
      // Fallback to heuristic if Gemini API fails
      const evaluation = evaluateNews(item);
      const IS_AIRDROP_HEURISTIC_THRESHOLD = 5; 
      const isAirdropByHeuristic = evaluation.score >= IS_AIRDROP_HEURISTIC_THRESHOLD;
      aiResult = {
        is_airdrop: isAirdropByHeuristic,
        is_scam: false,
        title: item.title,
        description: isAirdropByHeuristic ? "에어드랍 관련 내용입니다. (AI 분석 실패로 인한 휴리스틱 요약)" : "일반 뉴스입니다. (AI 분석 실패로 인한 휴리스틱 요약)",
        trust_score: evaluation.score,
        official_link: item.link,
        end_date: null,
      };
    }
    
    if (!aiResult || aiResult.is_scam === true) continue;
    
    // Now, save the result based on whether it's an airdrop or general news
    if (aiResult.is_airdrop) {
      const updateData = {
        title: aiResult.title,
        description: aiResult.description,
        official_link: aiResult.official_link || item.link,
        trust_score: aiResult.trust_score || 0,
        is_confirmed: aiResult.is_confirmed || false, // Assuming Gemini can return this
        is_airdrop: true,
        is_scam: aiResult.is_scam,
        unique_hash: item.id,
      };
      if (aiResult.end_date) updateData.end_date = new Date(aiResult.end_date);
      const newA = await Airdrop.findOneAndUpdate({ unique_hash: { $eq: item.id } }, { $set: updateData }, { upsert: true, new: true });
      if (updateData.trust_score >= 90) await sendPushNotifications(newA);
      console.log(`Saved Airdrop: ${aiResult.title} (Score: ${aiResult.trust_score})`);
    } else {
      const newsData = { 
        title: aiResult.title, 
        description: aiResult.description, 
        official_link: aiResult.official_link || item.link, 
        source: [item.sourceName], 
        unique_hash: item.id 
      };
      await News.findOneAndUpdate({ unique_hash: { $eq: item.id } }, { $set: newsData }, { upsert: true });
      console.log(`Saved News: ${aiResult.title}`);
    }
  } 
  console.log('--- Finished ---');
}
module.exports = { runScraper };
