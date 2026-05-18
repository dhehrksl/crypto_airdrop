const mongoose = require('mongoose');
const { isBlockedSource } = require('../src/config/blockedSources');

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
  trend_score: {
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
airdropSchema.index({ trend_score: -1 });
airdropSchema.index({ created_at: -1 });
airdropSchema.index({ end_date: 1 });
airdropSchema.index({ is_confirmed: -1 });

// 차단된 출처 진입 차단 — defense-in-depth.
// 스크래퍼/컨트롤러 가드를 우회하는 경로(직접 create, raw update 등)에서도 막힌다.
function assertNotBlocked(payload) {
  const check = isBlockedSource({
    link: payload.official_link,
    sources: Array.isArray(payload.source) ? payload.source : undefined,
    sourceName: typeof payload.source === 'string' ? payload.source : undefined,
  });
  if (check.blocked) {
    const err = new mongoose.Error.ValidationError();
    err.addError(
      'official_link',
      new mongoose.Error.ValidatorError({
        message: `차단된 출처입니다: ${check.matched} (reason=${check.reason})`,
        path: 'official_link',
        value: payload.official_link,
      })
    );
    throw err;
  }
}

airdropSchema.pre('save', function (next) {
  try {
    assertNotBlocked({ official_link: this.official_link, source: this.source });
    next();
  } catch (err) {
    next(err);
  }
});

airdropSchema.pre(/^(findOneAndUpdate|updateOne|updateMany|replaceOne)$/, function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || {};
    const payload = {
      official_link: update.official_link || $set.official_link,
      source: update.source || $set.source,
    };
    if (payload.official_link || payload.source) assertNotBlocked(payload);
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('Airdrop', airdropSchema);
