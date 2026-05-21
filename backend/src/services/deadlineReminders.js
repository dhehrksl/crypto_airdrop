// 마감 임박 에어드랍 리마인더 (airdrop-tracking-toolkit).
// cron이 주기적으로 실행 — 마감이 임박한 에어드랍을 추적(참여 ∪ 관심)하는 사용자에게
// D-3 / D-1 / 당일 마일스톤 푸시를 보낸다. 같은 (user, airdrop, milestone)은 한 번만.

const Airdrop = require('../../models/Airdrop');
const AirdropTracking = require('../../models/AirdropTracking');
const User = require('../../models/User');
const logger = require('../lib/logger');

const HOUR_MS = 60 * 60 * 1000;

// 마일스톤 = 마감까지 남은 시간 윈도우. 윈도우를 겹치지 않게 둬서, 늦게 관심 등록한
// 사용자가 이미 지난 마일스톤(예: 마감 40시간 전 등록 → D-3)을 잘못 받지 않게 한다.
// cron 간격(매시)보다 윈도우가 넓어(≥6h) 마일스톤을 놓치지 않는다.
const MILESTONES = [
  { key: 'DAY', minMs: 0, maxMs: 6 * HOUR_MS, label: '오늘' },
  { key: 'D1', minMs: 12 * HOUR_MS, maxMs: 24 * HOUR_MS, label: '약 1일' },
  { key: 'D3', minMs: 48 * HOUR_MS, maxMs: 72 * HOUR_MS, label: '약 3일' },
];
const SCAN_HORIZON_MS = 72 * HOUR_MS;

// 남은 시간이 어느 마일스톤 윈도우에 드는지 — 윈도우 사이 구간이면 null.
function milestoneFor(remainingMs) {
  for (const m of MILESTONES) {
    if (remainingMs >= m.minMs && remainingMs < m.maxMs) return m;
  }
  return null;
}

function reminderBody(airdrop, milestone) {
  return `'${airdrop.title}' 마감이 ${milestone.label} 남았습니다. (정보 제공 목적이며 투자 권유가 아닙니다)`;
}

// 기본 푸시 발송 — Expo SDK(v6 ESM-only)는 dynamic import. 테스트에서는 sendPush를 주입.
async function defaultSendPush(messages) {
  if (!messages || messages.length === 0) return;
  const { Expo } = await import('expo-server-sdk');
  const expo = new Expo();
  const valid = messages.filter((m) => Expo.isExpoPushToken(m.to));
  if (valid.length === 0) return;
  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      logger.error({ err: e }, '[Reminders] push send failed');
    }
  }
}

// 마감 임박 에어드랍을 스캔해 추적 사용자에게 리마인더 푸시.
// 옵션: now(기준 시각), sendPush(푸시 발송 함수 — 테스트 주입용).
async function runDeadlineReminders({ now = new Date(), sendPush = defaultSendPush } = {}) {
  const horizon = new Date(now.getTime() + SCAN_HORIZON_MS);
  // 마감이 미래이면서 72시간 이내인 에어드랍만 — 이미 마감된 것은 자연히 제외된다.
  const airdrops = await Airdrop.find({
    end_date: { $gt: now, $lte: horizon },
  }).lean();

  const messages = [];
  const updates = []; // { user, airdrop, milestone }

  for (const airdrop of airdrops) {
    const remainingMs = new Date(airdrop.end_date).getTime() - now.getTime();
    const milestone = milestoneFor(remainingMs);
    if (!milestone) continue; // 윈도우 사이 — 다음 마일스톤에서 처리

    // 추적 사용자 합집합: 참여(Airdrop.participatedBy) ∪ 관심(AirdropTracking.watchlisted)
    const watchDocs = await AirdropTracking.find({
      airdrop: airdrop._id,
      watchlisted: true,
    }).lean();
    const userIds = new Set();
    for (const id of airdrop.participatedBy || []) userIds.add(String(id));
    for (const d of watchDocs) userIds.add(String(d.user));
    if (userIds.size === 0) continue;

    // 이미 이 마일스톤을 받은 사용자 제외 (중복 발송 차단)
    const trackingDocs = await AirdropTracking.find({
      airdrop: airdrop._id,
      user: { $in: [...userIds] },
    }).lean();
    const sentByUser = new Map();
    for (const d of trackingDocs) sentByUser.set(String(d.user), d.remindersSent || []);
    const pendingUserIds = [...userIds].filter(
      (uid) => !(sentByUser.get(uid) || []).includes(milestone.key)
    );
    if (pendingUserIds.length === 0) continue;

    const users = await User.find({ _id: { $in: pendingUserIds } }).lean();
    for (const u of users) {
      if (!u.push_token) continue; // 푸시 토큰 없는 사용자 제외
      messages.push({
        to: u.push_token,
        sound: 'default',
        title: '에어드랍 마감 임박',
        body: reminderBody(airdrop, milestone),
        data: { airdropId: String(airdrop._id), kind: 'deadline-reminder' },
      });
      updates.push({ user: u._id, airdrop: airdrop._id, milestone: milestone.key });
    }
  }

  await sendPush(messages);

  // 발송한 사용자에 한해 remindersSent 기록 — 참여만 한 사용자는 문서가 없을 수 있어 upsert.
  for (const u of updates) {
    await AirdropTracking.updateOne(
      { user: u.user, airdrop: u.airdrop },
      { $addToSet: { remindersSent: u.milestone } },
      { upsert: true }
    );
  }

  const stats = {
    airdropsScanned: airdrops.length,
    remindersSent: updates.length,
    finishedAt: new Date().toISOString(),
  };
  logger.info(stats, '[Reminders] run finished');
  return stats;
}

module.exports = { runDeadlineReminders, milestoneFor, MILESTONES };
