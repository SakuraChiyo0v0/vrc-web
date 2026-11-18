import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateNotifications } from '../src/lib/notif.js';

const at = (minAgo) => new Date(Date.UTC(2026, 10, 18, 2, 0, 0) - minAgo * 60_000).toISOString();

test('同类型 24h 内合并，计数与 ids 正确', () => {
  const rows = [
    { id: 'a', type: 'invite', created_at: at(0), seen: false },
    { id: 'b', type: 'invite', created_at: at(30), seen: true },
    { id: 'c', type: 'invite', created_at: at(60), seen: false },
  ];
  const g = aggregateNotifications(rows);
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'a');
  assert.equal(g[0].count, 3);
  assert.deepEqual(g[0].ids, ['a', 'b', 'c']);
  assert.equal(g[0].unseen, 2);
  assert.equal(g[0].first_at, at(60));
  assert.equal(g[0].last_at, at(0));
  assert.equal(g[0].items.length, 3);
});

test('超过 24h 断开成两条，不同类型不合并', () => {
  const rows = [
    { id: 'a', type: 'invite', created_at: at(0), seen: true },
    { id: 'b', type: 'invite', created_at: at(60 * 25), seen: true },
    { id: 'c', type: 'friend_request', created_at: at(10), seen: true },
  ];
  const g = aggregateNotifications(rows);
  assert.deepEqual(g.map((x) => x.id), ['a', 'c', 'b']);
  assert.equal(g.find((x) => x.id === 'b').count, 1);
});

test('输入乱序也按时间倒序分组；空输入返回空', () => {
  const rows = [
    { id: 'old', type: 'invite', created_at: at(120), seen: true },
    { id: 'new', type: 'invite', created_at: at(1), seen: true },
  ];
  const g = aggregateNotifications(rows);
  assert.equal(g.length, 1);
  assert.equal(g[0].id, 'new');
  assert.deepEqual(g[0].ids, ['new', 'old']);
  assert.deepEqual(aggregateNotifications([]), []);
  assert.deepEqual(aggregateNotifications(null), []);
});

test('时间坏掉的条目不吞掉别的组', () => {
  const rows = [
    { id: 'bad', type: 'invite', created_at: null, seen: true },
    { id: 'ok', type: 'invite', created_at: at(0), seen: true },
  ];
  const g = aggregateNotifications(rows);
  assert.equal(g.length, 2);
  assert.ok(g.every((x) => x.count === 1));
});
