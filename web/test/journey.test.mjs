import assert from 'node:assert/strict';
import test from 'node:test';
import { barPct, dayVisits, groupMonths, monthLabel, monthOf } from '../src/lib/journey.js';

const days = [
  { date: '2026-10-01', minutes: 60, worlds: [] },
  { date: '2026-11-20', minutes: 30, worlds: [] },
  { date: '2026-11-22', minutes: 120, worlds: [] },
  { date: '2025-12-31', minutes: 5, worlds: [] },
  { date: '2026-11-21', minutes: 0, worlds: [] }
];

test('monthOf / monthLabel', () => {
  assert.equal(monthOf('2026-11-22'), '2026-11');
  assert.equal(monthLabel('2026-11'), '2026 年 11 月');
  assert.equal(monthLabel('2025-01'), '2025 年 1 月');
});

test('groupMonths: 月倒序、月内日倒序、合计与峰值', () => {
  const g = groupMonths(days);
  assert.deepEqual(g.map((m) => m.key), ['2026-11', '2026-10', '2025-12']);
  assert.deepEqual(g[0].days.map((d) => d.date), ['2026-11-22', '2026-11-21', '2026-11-20']);
  assert.equal(g[0].minutes, 150);
  assert.equal(g[0].max, 120);
  assert.equal(g[1].minutes, 60);
});

test('groupMonths: 空输入与缺字段不炸', () => {
  assert.deepEqual(groupMonths([]), []);
  assert.deepEqual(groupMonths([{ minutes: 10 }, null]), []);
  const g = groupMonths([{ date: '2026-01-02' }]);
  assert.equal(g[0].days[0].date, '2026-01-02');
  assert.equal(g[0].minutes, 0);
});

test('barPct: 0/负值/缺值不画，最小 2% 可见，最大 100%', () => {
  assert.equal(barPct(0, 100), 0);
  assert.equal(barPct(null, 100), 0);
  assert.equal(barPct(-5, 100), 0);
  assert.equal(barPct(1, 10000), 2);
  assert.equal(barPct(100, 100), 100);
  assert.equal(barPct(50, 100), 50);
  assert.equal(barPct(5, 0), 0);
});

test('dayVisits: 世界到访摊平后按时间倒序，带世界名', () => {
  const rows = dayVisits({
    worlds: [
      { world_id: 'wrld_a', world_name: 'Alpha', visits: [{ start_at: '2026-11-22T10:00:00Z', minutes: 10 }] },
      { world_id: 'wrld_b', world_name: 'Beta', visits: [
        { start_at: '2026-11-22T12:00:00Z', minutes: 20 },
        { start_at: '2026-11-22T08:00:00Z', minutes: 5 }
      ] }
    ]
  });
  assert.deepEqual(rows.map((r) => r.world_name), ['Beta', 'Alpha', 'Beta']);
  assert.equal(rows[0].world_id, 'wrld_b');
});
