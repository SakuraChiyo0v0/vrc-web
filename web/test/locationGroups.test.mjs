import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFriendsByLocation, worldTitle } from '../src/lib/locationGroups.js';

const f = (o) => ({ online: true, location: 'wrld_a:1', world_id: 'wrld_a', world_name: 'Farm', access_label: '好友+', ...o });

test('同实例 ≥2 人成一栏，标题带区域/世界/访问级别', () => {
  const rows = [f({ user_id: 'u1', region: 'jp' }), f({ user_id: 'u2', region: 'jp' })];
  const g = groupFriendsByLocation(rows);
  assert.equal(g.length, 1);
  assert.equal(g[0].type, 'world');
  assert.equal(g[0].label, 'Farm · 好友+');
  assert.deepEqual(g[0].rows.map((r) => r.user_id), ['u1', 'u2']);
});

test('单人按 收藏 / 其他在线 / 私密 分栏，顺序固定，离线垫底', () => {
  const rows = [
    f({ user_id: 'a', location: 'wrld_b:2', world_id: 'wrld_b', world_name: 'Bar', region: 'us' }),
    f({ user_id: 'fav', location: 'wrld_c:3', world_id: 'wrld_c', world_name: 'Den', favorite: true }),
    f({ user_id: 'priv', location: 'private', world_id: null, world_name: null }),
    f({ user_id: 'off', online: false, location: 'offline' })
  ];
  const g = groupFriendsByLocation(rows);
  assert.deepEqual(g.map((x) => x.label), ['好友收藏', '其他在线好友', '位于私人房间', '离线']);
});

test('世界栏按人数降序；同世界不同实例不算同栏', () => {
  const rows = [
    f({ user_id: 'a1', location: 'wrld_a:1' }),
    f({ user_id: 'a2', location: 'wrld_a:2' }),
    f({ user_id: 'b1', location: 'wrld_b:1', world_id: 'wrld_b', world_name: 'Bar' })
  ];
  const g = groupFriendsByLocation(rows);
  // wrld_a 两个实例各 1 人 → 进「其他在线好友」，wrld_b 也只有 1 人
  assert.equal(g[0].label, '其他在线好友');
  assert.equal(g[0].rows.length, 3);
});

test('私密栏只收在线：离线好友 location 残留 private 也归离线', () => {
  const rows = [
    f({ user_id: 'p1', location: 'private', world_id: null, world_name: null }),
    f({ user_id: 'p2', online: false, location: 'private', world_id: null, world_name: null }),
    f({ user_id: 'off', online: false, location: 'offline' })
  ];
  const g = groupFriendsByLocation(rows);
  const priv = g.find((x) => x.type === 'private');
  const off = g.find((x) => x.type === 'offline');
  assert.deepEqual(priv.rows.map((r) => r.user_id), ['p1']);
  assert.deepEqual(off.rows.map((r) => r.user_id).sort(), ['off', 'p2']);
});

test('世界栏带 region / access 供组头渲染', () => {
  const g = groupFriendsByLocation([
    f({ user_id: 'u1', region: 'jp' }),
    f({ user_id: 'u2', region: 'jp' })
  ]);
  assert.equal(g[0].region, 'JP');
  assert.equal(g[0].access_label, '好友+');
});

test('切换中/无位置的在线好友不消失：进「其他在线好友」，不会两人拼成一栏', () => {
  const rows = [
    f({ user_id: 't1', location: 'traveling', world_id: null, world_name: null, region: null }),
    f({ user_id: 't2', location: 'traveling', world_id: null, world_name: null, region: null }),
    f({ user_id: 'n1', location: null, world_id: null, world_name: null, region: null })
  ];
  const g = groupFriendsByLocation(rows);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, '其他在线好友');
  assert.deepEqual(g[0].rows.map((r) => r.user_id).sort(), ['n1', 't1', 't2']);
});

test('worldTitle 只放世界名·访问级别，区域交给组头徽标（不重复 JPJP）', () => {
  assert.equal(worldTitle({ world_name: 'Solo' }), 'Solo');
  assert.equal(worldTitle({ world_name: 'Farm', region: 'jp', access_label: '好友+' }), 'Farm · 好友+');
});

test('空输入不炸', () => {
  assert.deepEqual(groupFriendsByLocation(null), []);
  assert.deepEqual(groupFriendsByLocation([]), []);
});
