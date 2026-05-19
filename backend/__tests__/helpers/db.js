// 인메모리 MongoDB helper — 통합 테스트 전용.
// MongoMemoryServer를 띄우고 mongoose를 그 URI에 연결. 각 테스트 파일에서 beforeAll/afterAll로 사용.
// 동일 worker 내 여러 테스트가 같은 인스턴스를 공유하고 afterEach에서 컬렉션만 비우면 충분.

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

async function startInMemoryMongo() {
  if (mongoServer) return; // 같은 worker에서 중복 시작 방지
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function stopInMemoryMongo() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

async function clearCollections() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { startInMemoryMongo, stopInMemoryMongo, clearCollections };
