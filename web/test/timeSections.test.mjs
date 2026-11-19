import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKey, sectionOf, splitSections } from '../src/lib/timeSections.js';

// 固定「现在」= 2026-11-19 13:00 +08
const NOW = new Date('2026-11-19T05:00:00.000Z');
const at = (s) => ({ at: s });

test('dayKey 按 +08 切日：UTC 16:30 算第二天', () => {
  assert.equal(dayKey('2026-11-18T16:30:00.000Z'), '2026-11-19');
  assert.equal(dayKey('2026-11-18T15:30:00.000Z'), '2026-11-18');
  assert.equal(dayKey('bad'), '');
});

test('sectionOf 分今天/昨天/更早，坏时间归更早', () => {
  assert.equal(sectionOf('2026-11-19T04:00:00.000Z', NOW), 'today');
  assert.equal(sectionOf('2026-11-18T04:00:00.000Z', NOW), 'yesterday');
  assert.equal(sectionOf('2026-11-01T04:00:00.000Z', NOW), 'earlier');
  assert.equal(sectionOf(null, NOW), 'earlier');
});

test('splitSections 只留非空段、段序固定、段内保序', () => {
  const rows = [
    at('2026-11-19T04:00:00.000Z'),
    at('2026-11-18T04:00:00.000Z'),
    at('2026-11-19T02:00:00.000Z'),
    at('2026-10-01T04:00:00.000Z'),
  ];
  const out = splitSections(rows, (x) => x.at, NOW);
  assert.deepEqual(out.map((s) => s.label), ['今天', '昨天', '更早']);
  assert.deepEqual(out[0].items.map((x) => x.at), ['2026-11-19T04:00:00.000Z', '2026-11-19T02:00:00.000Z']);
  assert.equal(out.reduce((n, s) => n + s.items.length, 0), 4);

  const only = splitSections([at('2026-11-19T04:00:00.000Z')], (x) => x.at, NOW);
  assert.deepEqual(only.map((s) => s.label), ['今天']);
  assert.deepEqual(splitSections([], undefined, NOW), []);
});
