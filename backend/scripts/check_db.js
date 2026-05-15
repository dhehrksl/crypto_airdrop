require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Airdrop = require('../models/Airdrop');
const News = require('../models/News');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function checkDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');
    
    console.log('\\n--- Latest 3 Airdrops ---');
    const airdrops = await Airdrop.find().sort({ created_at: -1 }).limit(3);
    airdrops.forEach(a => {
      console.log(`Title: ${a.title}`);
      console.log(`Is Airdrop: ${a.is_airdrop}`);
      console.log(`Description: ${a.description.substring(0, 50)}...`);
      console.log('---');
    });

    console.log('\\n--- Latest 3 News ---');
    const news = await News.find().sort({ publishedAt: -1 }).limit(3);
    news.forEach(n => {
      console.log(`Title: ${n.title}`);
      console.log(`Description: ${n.description?.substring(0, 50)}...`);
      console.log('---');
    });

  } catch (e) {
    console.error(e);
  } finally {
    mongoose.connection.close();
  }
}

checkDb();