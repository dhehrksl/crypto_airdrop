// DB에 저장된 항목들을 점검용으로 출력
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Airdrop = require('../models/Airdrop');
const News = require('../models/News');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');

  const airdrops = await Airdrop.find({}).lean();
  const news = await News.find({}).lean();

  console.log(`\n=== AIRDROPS (${airdrops.length}건) ===`);
  airdrops.forEach((d, i) => {
    console.log(`\n[#${i + 1}] _id=${d._id}`);
    console.log(`  is_airdrop: ${d.is_airdrop}`);
    console.log(`  is_scam: ${d.is_scam}`);
    console.log(`  trust_score: ${d.trust_score}`);
    console.log(`  title: ${d.title}`);
    console.log(`  description: ${(d.description || '').slice(0, 120)}`);
    console.log(`  official_link: ${d.official_link}`);
    console.log(`  end_date: ${d.end_date || 'null'}`);
  });

  console.log(`\n\n=== NEWS (${news.length}건) ===`);
  news.forEach((d, i) => {
    console.log(`\n[#${i + 1}] _id=${d._id}`);
    console.log(`  title: ${d.title}`);
    console.log(`  description: ${(d.description || '').slice(0, 120)}`);
    console.log(`  source: ${JSON.stringify(d.source)}`);
  });

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
