const mongoose = require('mongoose');
const { isBlockedSource } = require('../src/config/blockedSources');

const newsSchema = new mongoose.Schema({
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
  source: {
    type: [String],
    required: true,
  },
  unique_hash: {
    type: String,
    required: true,
    unique: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  }
});

newsSchema.index({ created_at: -1 });

// 차단된 출처는 News에도 저장되지 않아야 함 (AI가 official_link를 변형할 수 있어 흘러들 위험).
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

newsSchema.pre('save', function (next) {
  try {
    assertNotBlocked({ official_link: this.official_link, source: this.source });
    next();
  } catch (err) {
    next(err);
  }
});

newsSchema.pre(/^(findOneAndUpdate|updateOne|updateMany|replaceOne)$/, function (next) {
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

module.exports = mongoose.model('News', newsSchema);
