const mongoose = require('mongoose');

// (사용자, 에어드랍) 쌍마다 문서 하나. 워치리스트 여부 + 단계별 진행 + 리마인더 발송 이력을
// 한 곳에 담는다. 문서가 없으면 "추적 안 함" 상태이며, 어느 기능이라도 사용하면 upsert로 생성된다.
// 기존 참여 기능(Airdrop.participatedBy)은 그대로 두므로 이 컬렉션은 non-breaking 추가다.

// 리마인더 마일스톤 — 마감까지 남은 시간 윈도우 기준 (deadlineReminders.js 참고).
const REMINDER_MILESTONES = ['D3', 'D1', 'DAY'];

const airdropTrackingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    airdrop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Airdrop',
      required: true,
    },
    // 관심 목록(워치리스트) 등록 여부. 참여 상태(Airdrop.participatedBy)와 독립적.
    watchlisted: {
      type: Boolean,
      default: false,
    },
    // 완료 처리한 Airdrop.tasks 인덱스 목록.
    completedTasks: {
      type: [Number],
      default: [],
    },
    // 이미 발송한 마감 리마인더 마일스톤. 같은 (user, airdrop, milestone) 중복 발송 차단용.
    remindersSent: {
      type: [{ type: String, enum: REMINDER_MILESTONES }],
      default: [],
    },
  },
  { timestamps: true }
);

// (user, airdrop)는 유일 — upsert 키.
airdropTrackingSchema.index({ user: 1, airdrop: 1 }, { unique: true });
// 리마인더 스캐너가 특정 에어드랍을 추적하는 사용자를 역방향 조회할 때 사용.
airdropTrackingSchema.index({ airdrop: 1 });

const AirdropTracking = mongoose.model('AirdropTracking', airdropTrackingSchema);
AirdropTracking.REMINDER_MILESTONES = REMINDER_MILESTONES;

module.exports = AirdropTracking;
