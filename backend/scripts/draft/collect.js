// Draft 수집 1회 수동 실행 — Reddit(env로 활성 시) + Telegram 공개 채널에서
// 최근 게시글을 모아 AI 구조 추출 → AirdropDraft 관리자 검수 큐에 적재한다.
//
// 평소엔 server.js의 DRAFT_COLLECT_CRON(6시간)이 처리하지만, 수동 트리거가 필요할 때 사용.
//
// 사용법: node scripts/draft/collect.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { runCollection } = require('../../controllers/adminDraftController');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_airdrop';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const result = await runCollection('manual-script');
    console.log('Collection result:', JSON.stringify(result, null, 2));

    console.log('Job finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();
