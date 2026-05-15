require('dotenv').config();
const mongoose = require('mongoose');
const Airdrop = require('./models/Airdrop');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function insertMockData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const mockAirdrops = [
      {
        title: 'Jupiter (JUP) LFG Launchpad',
        description: '1. 솔라나 지갑 연결\n2. JUP 할당량 확인\n3. LFG 런치패드에서 클레임 진행',
        official_link: 'https://jup.ag/airdrop',
        trust_score: 98,
        source: ['System-Manual'],
        unique_hash: 'manual_jup_001'
      },
      {
        title: 'Ether.fi Season 2',
        description: '1. ether.fi 접속\n2. 스테이킹 상태 확인\n3. 시즌 2 로열티 포인트 기반 보상 확인',
        official_link: 'https://app.ether.fi/airdrop',
        trust_score: 95,
        source: ['System-Manual'],
        unique_hash: 'manual_ether_001'
      },
      {
        title: 'Kamino Finance (KMNO)',
        description: '1. Kamino Finance 대시보드 접속\n2. KMNO 토큰 할당량 확인\n3. 공식 클레임 페이지에서 진행',
        official_link: 'https://app.kamino.finance',
        trust_score: 92,
        source: ['System-Manual'],
        unique_hash: 'manual_kamino_001'
      }
    ];

    for (const data of mockAirdrops) {
      await Airdrop.findOneAndUpdate(
        { unique_hash: data.unique_hash },
        { $set: data },
        { upsert: true, new: true }
      );
      console.log(`Inserted/Updated: ${data.title}`);
    }

    console.log('Mock data insertion complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error inserting mock data:', error);
    process.exit(1);
  }
}

insertMockData();
