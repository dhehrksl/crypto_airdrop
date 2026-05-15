const mongoose = require('mongoose');

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

module.exports = mongoose.model('News', newsSchema);
