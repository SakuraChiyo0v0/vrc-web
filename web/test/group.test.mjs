import assert from 'node:assert/strict';
import test from 'node:test';
import { GROUP_MODES, groupFriends, TRUST_LABEL } from '../src/lib/group.js';

const rows = [
  { user_id: 'a', display_name: 'A', favorite: true, trust_rank: 4, online: true, location: 'wrld_1', world_id: 'wrld_1', world_name: '世界一' },
  { user_id: 'b', display_name: 'B', favorite: false, trust_rank: 1, online: true, location: 'wrld_1', world_id: 'wrld_1', world_name: '世界一' },
  { user_id: 'c', display_name: 'C', favorite: false, trust_rank: 3, online: false, location: 'offline', world_name: null }
];

test('三种分组模式都在 GROUP_MODES 里', () => {
  assert.deepEqual(Object.keys(GROUP_MODES).sort(), ['favorite', 'none', 'trust', 'world']);
});

test('世界分组：同世界合并，离线垫底', () => {
  const g = groupFriends(rows, 'world');
  assert.equal(g.length, 2);
  assert.equal(g[0].key, 'wrld_1');
  assert.equal(g[0].count, 2);
  assert.equal(g.at(-1).key, 'offline');
  assert.equal(g.at(-1).label, '不在线');
});

test('收藏分组：收藏在前，各带计数', () => {
  const g = groupFriends(rows, 'favorite');
  assert.deepEqual(g.map((x) => [x.label, x.count]), [['收藏', 1], ['未收藏', 2]]);
});

test('信任等级分组：4→1 顺序，未知垫底', () => {
  const g = groupFriends([...rows, { user_id: 'd', display_name: 'D', trust_rank: null }], 'trust');
  assert.deepEqual(g.map((x) => x.label), ['可信用户', '已知用户', '新用户', '未分级']);
  assert.equal(g.at(-1).key, 'unknown');
  assert.equal(TRUST_LABEL(2), '基本用户');
});

test('不分组：单组且行顺序不变', () => {
  const g = groupFriends(rows, 'none');
  assert.equal(g.length, 1);
  assert.equal(g[0].count, 3);
  assert.deepEqual(g[0].rows.map((r) => r.user_id), ['a', 'b', 'c']);
});

test('非法模式降级为不分组，空输入不抛', () => {
  assert.equal(groupFriends(rows, 'nope')[0].key, 'all');
  assert.equal(groupFriends(null, 'world').length, 0);
});
