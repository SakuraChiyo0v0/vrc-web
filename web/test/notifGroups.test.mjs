import assert from 'node:assert/strict';
import test from 'node:test';
import { groupByType, groupSummary } from '../src/lib/notifGroups.js';

const n = (id, type, extra = {}) => ({ id, type, created_at: '2026-11-19T04:00:00.000Z', seen: true, count: 1, ...extra });

test('同类型收成一组，组序按首次出现，组内保持原顺序', () => {
  const g = groupByType([
    n('a', 'invite'),
    n('b', 'group_announcement'),
    n('c', 'invite'),
    n('d', 'invite'),
  ]);
  assert.deepEqual(g.map((x) => x.type), ['invite', 'group_announcement']);
  assert.deepEqual(g[0].items.map((x) => x.id), ['a', 'c', 'd']);
  assert.equal(g[0].count, 3);
});

test('未读数：按聚合条 unseen 累加，没有 unseen 时未读=1', () => {
  const g = groupByType([
    n('a', 'invite', { count: 3, unseen: 2 }),
    n('b', 'invite', { seen: false }),
  ]);
  assert.equal(g[0].unseen, 3);
  assert.equal(g[0].opened, true, '有未读默认展开');
  const quiet = groupByType([n('x', 'invite'), n('y', 'invite')]);
  assert.equal(quiet[0].unseen, 0);
  assert.equal(quiet[0].opened, false, '全读过默认折叠');
});

test('组头文案带组数与未读，聚合展开条数不同时补总条数', () => {
  const [g] = groupByType([n('a', 'invite', { count: 3, unseen: 1 }), n('b', 'invite', { count: 2, unseen: 1 })]);
  assert.equal(groupSummary(g, { invite: '邀请' }), '邀请 · 2 组 · 5 条 · 未读 2');
  const [one] = groupByType([n('a', 'message')]);
  assert.equal(groupSummary(one, {}), 'message · 1 组');
});

test('空输入返回空数组，未知 type 归到 other')() => {};
