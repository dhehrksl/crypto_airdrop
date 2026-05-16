const { extractEndDateFromText } = require('../../src/services/airdropsIoScraper');

const cases = [
  ['The campaign ends on August 8, 2026, or when protocol TVL reaches $500M', '2026-08-08'],
  ['Deadline: December 31, 2026', '2026-12-31'],
  ['valid until 2026-09-15.', '2026-09-15'],
  ['closes on Aug 15, 2026', '2026-08-15'],
  ['expires on December 1, 2026', '2026-12-01'],
  ['runs until September 30, 2026', '2026-09-30'],
  ['Snapshot taken on August 8th, 2026.', null], // 'taken on' 같은 건 무시되어야 함
  ['Ends 2026-07-25', '2026-07-25'],
  ['No deadline mentioned at all.', null],
  ['ended on January 5, 2024', null], // 과거
];

for (const [text, expected] of cases) {
  const r = extractEndDateFromText(text);
  const iso = r ? r.toISOString().slice(0, 10) : null;
  const ok = iso === expected ? 'OK' : 'FAIL';
  console.log(`[${ok}] ${JSON.stringify(text.slice(0, 60))} => ${iso} (expected ${expected})`);
}
