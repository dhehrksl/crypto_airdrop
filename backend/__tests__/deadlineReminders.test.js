// 마감 리마인더 서비스 테스트 (airdrop-tracking-toolkit).

const Airdrop = require('../models/Airdrop');
const AirdropTracking = require('../models/AirdropTracking');
const User = require('../models/User');
const {
  runDeadlineReminders,
  milestoneFor,
} = require('../src/services/deadlineReminders');
const {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} = require('./helpers/db');

beforeAll(async () => {
  await startInMemoryMongo();
});

afterAll(async () => {
  await stopInMemoryMongo();
});

afterEach(async () => {
  await clearCollections();
});

const HOUR = 60 * 60 * 1000;
let hashCounter = 0;

async function createAirdrop(endOffsetMs, overrides = {}) {
  return Airdrop.create({
    title: 'Deadline Airdrop',
    description: 'desc',
    official_link: 'https://example.com/drop',
    trend_score: 50,
    source: ['test'],
    unique_hash: `rem-hash-${hashCounter++}`,
    end_date: new Date(Date.now() + endOffsetMs),
    ...overrides,
  });
}

// 캡처용 가짜 푸시 발송기
function makeSendPush() {
  const sent = [];
  const sendPush = async (messages) => {
    for (const m of messages) sent.push(m);
  };
  return { sent, sendPush };
}

describe('milestoneFor — 윈도우 판정', () => {
  test('남은 시간별 마일스톤', () => {
    expect(milestoneFor(60 * HOUR)?.key).toBe('D3');
    expect(milestoneFor(18 * HOUR)?.key).toBe('D1');
    expect(milestoneFor(3 * HOUR)?.key).toBe('DAY');
  });

  test('윈도우 사이 구간은 null', () => {
    expect(milestoneFor(30 * HOUR)).toBeNull(); // D1(12~24h)과 D3(48~72h) 사이
    expect(milestoneFor(9 * HOUR)).toBeNull(); // DAY(0~6h)과 D1(12~24h) 사이
  });
});

describe('runDeadlineReminders', () => {
  test('관심 등록한 사용자에게 D-1 리마인더 발송', async () => {
    const now = new Date();
    const airdrop = await createAirdrop(18 * HOUR); // D1 윈도우
    const user = await User.create({
      username: 'remuser1',
      push_token: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
    });
    await AirdropTracking.create({ user: user._id, airdrop: airdrop._id, watchlisted: true });

    const { sent, sendPush } = makeSendPush();
    const stats = await runDeadlineReminders({ now, sendPush });

    expect(sent).toHaveLength(1);
    expect(stats.remindersSent).toBe(1);
    const doc = await AirdropTracking.findOne({ user: user._id, airdrop: airdrop._id });
    expect(doc.remindersSent).toContain('D1');
  });

  test('같은 마일스톤은 다음 실행에서 중복 발송하지 않는다', async () => {
    const now = new Date();
    const airdrop = await createAirdrop(18 * HOUR);
    const user = await User.create({
      username: 'remuser2',
      push_token: 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]',
    });
    await AirdropTracking.create({ user: user._id, airdrop: airdrop._id, watchlisted: true });

    const first = makeSendPush();
    await runDeadlineReminders({ now, sendPush: first.sendPush });
    const second = makeSendPush();
    await runDeadlineReminders({ now, sendPush: second.sendPush });

    expect(first.sent).toHaveLength(1);
    expect(second.sent).toHaveLength(0);
  });

  test('참여(participatedBy) 중인 사용자도 리마인더 대상', async () => {
    const now = new Date();
    const user = await User.create({
      username: 'remuser3',
      push_token: 'ExponentPushToken[cccccccccccccccccccccc]',
    });
    const airdrop = await createAirdrop(3 * HOUR, { participatedBy: [user._id] }); // DAY 윈도우

    const { sent, sendPush } = makeSendPush();
    await runDeadlineReminders({ now, sendPush });

    expect(sent).toHaveLength(1);
  });

  test('푸시 토큰이 없는 사용자는 제외된다', async () => {
    const now = new Date();
    const airdrop = await createAirdrop(18 * HOUR);
    const noToken = await User.create({ username: 'remuser4' });
    await AirdropTracking.create({ user: noToken._id, airdrop: airdrop._id, watchlisted: true });

    const { sent, sendPush } = makeSendPush();
    await runDeadlineReminders({ now, sendPush });

    expect(sent).toHaveLength(0);
  });

  test('이미 마감된 에어드랍은 대상에서 제외', async () => {
    const now = new Date();
    const airdrop = await createAirdrop(-2 * HOUR); // 이미 마감
    const user = await User.create({
      username: 'remuser5',
      push_token: 'ExponentPushToken[dddddddddddddddddddddd]',
    });
    await AirdropTracking.create({ user: user._id, airdrop: airdrop._id, watchlisted: true });

    const { sent, sendPush } = makeSendPush();
    await runDeadlineReminders({ now, sendPush });

    expect(sent).toHaveLength(0);
  });

  test('아무도 추적하지 않는 마감 임박 에어드랍 → 발송 없음', async () => {
    const now = new Date();
    await createAirdrop(18 * HOUR); // 추적 사용자 없음

    const { sent, sendPush } = makeSendPush();
    await runDeadlineReminders({ now, sendPush });

    expect(sent).toHaveLength(0);
  });
});
