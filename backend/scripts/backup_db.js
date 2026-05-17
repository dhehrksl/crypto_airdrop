// 모든 컬렉션을 JSON으로 백업 (mongodump 대체).
// 출력: ../backups/backup-<ISO_TS>/<collection>.json

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');
const mongoose = require('mongoose');

const Airdrop = require('../models/Airdrop');
const News = require('../models/News');
const User = require('../models/User');
const Submission = require('../models/Submission');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crypto_airdrop');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(__dirname, `../../backups/backup-${ts}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, Model] of [
    ['airdrops', Airdrop],
    ['news', News],
    ['users', User],
    ['submissions', Submission],
  ]) {
    const docs = await Model.find({}).lean();
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs, null, 2));
    console.log(`  ${name}: ${docs.length}건 → ${name}.json`);
  }
  await mongoose.disconnect();
  console.log(`\n백업 위치: ${dir}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
