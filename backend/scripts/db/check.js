const mongoose = require('mongoose');
const Airdrop = require('./models/Airdrop');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function checkDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const airdrops = await Airdrop.find({});
    console.log('Total airdrops:', airdrops.length);
    airdrops.forEach(a => {
      console.log(`ID: ${a.unique_hash}, Link: ${a.official_link}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
