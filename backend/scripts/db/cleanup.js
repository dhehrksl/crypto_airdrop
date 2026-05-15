require('dotenv').config();
const mongoose = require('mongoose');
const Airdrop = require('./models/Airdrop');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for cleanup.');

    // 1. 신뢰도 70점 미만 삭제
    // 2. 제목에 '2023', '2024' 등 과거 날짜가 들어간 명백한 과거 뉴스 삭제 (임시)
    const result = await Airdrop.deleteMany({
      $or: [
        { trust_score: { $lt: 70 } },
        { title: { $regex: /2023|2024|ended|closed|recap/i } }
      ]
    });

    console.log(`Cleanup finished. Deleted ${result.deletedCount} low-quality items.`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

cleanup();
