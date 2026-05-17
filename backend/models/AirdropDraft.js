// 커뮤니티(레딧/텔레그램/URL 붙여넣기) → AI 추출 → 관리자 승인 대기.
// 승인되면 Airdrop 컬렉션으로 옮겨지고 status=approved, publishedAirdrop 채워짐.
// Submission(사용자 제보)과 별도 — Submission은 사용자 자유 입력, Draft는 AI 추출 후보.

const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
  // AI 추출 결과
  title: { type: String, required: true, trim: true, maxlength: 300 },
  description: { type: String, required: true, maxlength: 4000 },
  official_link: { type: String, required: true, trim: true, maxlength: 600 },
  tokenTicker: { type: String, trim: true, maxlength: 20 },
  tasks: { type: [String], default: undefined }, // 참여 단계 — Airdrop 모델과 동일 형태
  end_date: { type: Date },
  category: { type: String, trim: true, maxlength: 60 },
  chain: { type: [String], default: undefined },
  trust_score: { type: Number, min: 0, max: 100, default: 70 },
  is_scam_suspect: { type: Boolean, default: false }, // AI가 스캠 의심으로 표시

  // 원본 추적
  source_name: { type: String, required: true, trim: true }, // 'reddit:r/airdrops', 'telegram:airdropalert', 'url:pasted'
  source_url: { type: String, trim: true }, // 원본 게시글 URL (있으면)
  source_excerpt: { type: String, maxlength: 1500 }, // AI에 넘긴 원본 일부 (감사용)

  // 중복 방지 — 원본 URL/ID 해시
  unique_hash: { type: String, required: true, unique: true, index: true },

  // 상태
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },

  // 관리자 처리
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, maxlength: 500 },
  publishedAirdrop: { type: mongoose.Schema.Types.ObjectId, ref: 'Airdrop' },

  // 시간
  collected_at: { type: Date, default: Date.now, index: true },
});

draftSchema.index({ status: 1, collected_at: -1 });

module.exports = mongoose.model('AirdropDraft', draftSchema);
