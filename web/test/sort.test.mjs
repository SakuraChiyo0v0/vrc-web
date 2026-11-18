/**
 * 101/102 纯函数测试：表头排序 + localStorage 偏好。
 *   node --test web/test/  （npm test）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SORT_COLUMNS, sortRows, toggleSort, readPref, writePref, prefKey } from '../src/lib/sort.js';

const friends = [
  { display_name: '小红', display_name_key: 1, online: true, world_name: 'World A', online_minutes: 30, status: 'active' },
  { display_name: 'Alice', online: true, world_name: 'World B', online_minutes: 120, status: 'busy' },
  { display_name: 'Zoe', online: false, world_name: 'World C', online_minutes: 5, status: 'offline' },
  { display_name: '鲍勃', online: false, online_minutes: null, status: 'offline' },
];

const names = (rows) => rows.map((r) => r.display_name);

test('101 按名字排序：中文按拼音序，不丢行、不改原数组', () => {
  const src = [...friends];
  const out = sortRows(src, SORT_COLUMNS.friends, 'name', 'asc');
  assert.equal(out.length, friends.length);
  assert.deepEqual(names(src), names(friends), 'sortRows 不能原地改传入数组');
  // zh-Hans-CN Collator：汉字按拼音序（鲍 bāo < 小 xiǎo），汉字整体排在拉丁字母前
  assert.deepEqual(names(out), ['鲍勃', '小红', 'Alice', 'Zoe']);
});

test('101 数字列降序：时长多的在前，空值永远垫底', () => {
  const out = sortRows(friends, SORT_COLUMNS.friends, 'duration', 'desc');
  assert.deepEqual(names(out).slice(0, 3), ['Alice', '小红', 'Zoe']);
  assert.equal(names(out).at(-1), '鲍勃', '没有时长的排最后');
  const asc = sortRows(friends, SORT_COLUMNS.friends, 'duration', 'asc');
  assert.equal(names(asc).at(-1), '鲍勃', '升序时空值也垫底');
  assert.deepEqual(names(asc).slice(0, 3), ['Zoe', '小红', 'Alice']);
});

test('101 离线好友没有所在世界 → 世界列排序时垫底', () => {
  const out = sortRows(friends, SORT_COLUMNS.friends, 'world', 'asc');
  assert.deepEqual(names(out).slice(0, 2), ['小红', 'Alice']);
  assert.deepEqual(names(out).slice(2), ['鲍勃', 'Zoe'], '两个离线（空世界）按名字兜底排最后');
});

test('101 未知列/非数组不炸，返回可遍历的数组', () => {
  assert.deepEqual(sortRows(friends, SORT_COLUMNS.friends, 'nope', 'asc'), friends);
  assert.deepEqual(sortRows(null, SORT_COLUMNS.friends, 'name', 'asc'), []);
});

test('101 toggleSort：同列切方向，换列用该列默认方向', () => {
  const cols = SORT_COLUMNS.friends;
  assert.deepEqual(toggleSort({ key: 'name', dir: 'asc' }, cols, 'name'), { key: 'name', dir: 'desc' });
  assert.deepEqual(toggleSort({ key: 'name', dir: 'desc' }, cols, 'name'), { key: 'name', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'name', dir: 'asc' }, cols, 'duration'), { key: 'duration', dir: 'desc' });
  assert.deepEqual(toggleSort({ key: 'name', dir: 'desc' }, cols, 'world'), { key: 'world', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'name', dir: 'asc' }, cols, 'bogus'), { key: 'name', dir: 'asc' });
});

/** localStorage 桩：记录写入，能模拟隐私模式抛错 */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('102 偏好读写：前缀隔离、JSON 往返、刷新后还原', () => {
  const s = fakeStorage();
  assert.equal(writePref(s, 'friends:tab', 'all'), true);
  assert.ok(s.map.has(prefKey('friends:tab')));
  assert.equal(prefKey('friends:tab'), 'vrc-pref:friends:tab');
  assert.equal(readPref(s, 'friends:tab', 'online'), 'all');
  assert.deepEqual(readPref(s, 'sort:friends', { key: 'name', dir: 'asc' }), { key: 'name', dir: 'asc' });
});

test('102 旧存档缺字段时合并默认值（加字段不丢新键）', () => {
  const s = fakeStorage({ 'vrc-pref:friendlog:kinds': '["online"]' });
  assert.deepEqual(readPref(s, 'friendlog:kinds', []), ['online']);
  const s2 = fakeStorage({ 'vrc-pref:page:worlds': '{"q":"park"}' });
  assert.deepEqual(readPref(s2, 'page:worlds', { q: '', sort: 'recent' }), { q: 'park', sort: 'recent' });
});

test('102 坏 JSON / 无 storage 不抛错，退回默认值', () => {
  const s = fakeStorage({ 'vrc-pref:x': '{not json' });
  assert.equal(readPref(s, 'x', 'fallback'), 'fallback');
  assert.equal(readPref(null, 'x', 'fallback'), 'fallback');
  assert.equal(writePref(null, 'x', 1), false);
  const boom = { getItem() { throw new Error('quota'); }, setItem() { throw new Error('quota'); } };
  assert.equal(readPref(boom, 'x', 'fb'), 'fb');
  assert.equal(writePref(boom, 'x', 1), false);
});
