require('dotenv').config();
const mongoose = require('mongoose');
const Airdrop = require('./models/Airdrop');
const News = require('./models/News');

async function checkAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const airdrops = await Airdrop.find({});
  console.log(`Total Airdrops in DB: ${airdrops.length}`);
  airdrops.forEach(a => {
    console.log(`- [Airdrop] Title: ${a.title}, Score: ${a.trust_score}`);
  });

  const news = await News.find({});
  console.log(`Total News in DB: ${news.length}`);
  news.forEach(n => {
    console.log(`- [News] Title: ${n.title}`);
  });
  
  process.exit();
}
checkAll();
