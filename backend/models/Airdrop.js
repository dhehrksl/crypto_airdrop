const mongoose = require('mongoose');

const airdropSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  official_link: {
    type: String,
    required: true,
  },
  end_date: {
    type: Date,
  },
  tokenTicker: {
    type: String,
    trim: true,
  },
  trust_score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  is_confirmed: {
    type: Boolean,
    default: false,
  },
  is_airdrop: {
    type: Boolean,
    default: true,
  },
  is_scam: {
    type: Boolean,
    default: false,
  },
  // airdrops.io 등 카탈로그형 소스에서 채워지는 필드 — RSS 출처는 비워둠
  chain: {
    type: [String],
    default: undefined,
  },
  category: {
    type: String,
    trim: true,
  },
  tasks: {
    type: [String],
    default: undefined,
  },
  source: {
    type: [String], // 출처를 배열로 하여 중복 시 upsert 가능하게 처리
    required: true,
  },
  unique_hash: {
    type: String,
    required: true,
    unique: true, // 중복 방지 로직 (메시지 ID 또는 URL 해시)
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  participatedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

// 검색 성능을 위한 인덱스 추가
airdropSchema.index({ trust_score: -1 });
airdropSchema.index({ created_at: -1 });
airdropSchema.index({ end_date: 1 });
airdropSchema.index({ is_confirmed: -1 });


module.exports = mongoose.model('Airdrop', airdropSchema);
