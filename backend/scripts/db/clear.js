require('dotenv').config();
const mongoose = require('mongoose');
const Airdrop = require('../../models/Airdrop');
const News = require('../../models/News');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function clearDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const resultAirdrop = await Airdrop.deleteMany({});
    console.log(`Successfully cleared ${resultAirdrop.deletedCount} items from Airdrop collection.`);
    
    const resultNews = await News.deleteMany({});
    console.log(`Successfully cleared ${resultNews.deletedCount} items from News collection.`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1);
  }
}

clearDb();
