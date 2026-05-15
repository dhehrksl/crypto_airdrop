const mongoose = require('mongoose');

const GuaranteedAirdropSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
  },
  tokenTicker: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Layer1/Layer2', 'DEX', 'Bridge', 'Lending', 'NFT', 'Other'],
  },
  chain: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  tasks: {
    type: [String],
    required: true,
  },
  guideUrl: {
    type: String,
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['Easy', 'Medium', 'Hard'],
  },
  isConfirmed: {
    type: Boolean,
    default: false,
  },
  participatedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GuaranteedAirdrop', GuaranteedAirdropSchema);
