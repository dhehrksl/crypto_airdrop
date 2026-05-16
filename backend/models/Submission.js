const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  // 제보자
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // 제출 정보 — 자유 입력
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },
  official_link: { type: String, required: true, trim: true, maxlength: 500 },
  category: { type: String, trim: true, maxlength: 60 },
  chain: { type: String, trim: true, maxlength: 60 },
  end_date: { type: Date },
  // 상태: pending → approved → published / rejected
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  // 관리자 처리 메모
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, maxlength: 500 },
  // 승인되어 Airdrop으로 옮겨진 경우 그 참조
  publishedAirdrop: { type: mongoose.Schema.Types.ObjectId, ref: 'Airdrop' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Submission', submissionSchema);
