/**
 * 纯函数单元测试（node --test web/test/*.test.mjs）：68 / 69 / 70 的逻辑部分。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hourBars, BAR_AREA_PX } from '../src/lib/viz.js';
import { resolveShortcut, PAGE_ORDER } from '../src/lib/shortcuts.js';
import { parseVrcTarget } from '../src/lib/vrchatTarget.js';

const hourItems = (counts) => counts.map((n, hour) => ({ hour, n, share: 0 }));

test('70 有数据时每根柱子都有正像素高度，峰值占满画布', () => {
  const counts = new Array(24).fill(0);
  counts[21] = 12;
  counts[22] = 6;
  counts[20] = 1;
  const r = hourBars(hourItems(counts));
  assert.equal(r.empty, false);
  assert.equal(r.total, 19);
  assert.equal(r.peak, 21);
  assert.equal(r.bars.length, 24);
  assert.equal(r.bars[21].px, BAR_AREA_PX);
  assert.equal(r.bars[22].px, Math.round(BAR_AREA_PX / 2));
  assert.ok(r.bars[20].px >= 2, '只有 1 次也要看得见（≥2px）');
  // 0 次的柱子高度为 0，但不是 undefined
  assert.equal(r.bars[0].px, 0);
  assert.ok(r.bars.every((b) => Number.isFinite(b.px)));
});

test('70 无数据时空态：bars 为空、peak=null（不画空轴）', () => {
  assert.deepEqual(hourBars([]), { empty: true, total: 0, peak: null, max: 0, bars: [] });
  assert.equal(hourBars(hourItems(new Array(24).fill(0))).empty, true);
  assert.equal(hourBars(null).empty, true);
});

test('68 Ctrl/⌘+数字按侧栏顺序跳页', () => {
  assert.deepEqual(resolveShortcut({ key: '1', ctrlKey: true }), { type: 'navigate', page: 'friends', digit: 1 });
  assert.equal(resolveShortcut({ key: '3', metaKey: true }).page, 'notifications');
  assert.equal(resolveShortcut({ key: '7', ctrlKey: true }).page, 'stats');
  assert.equal(resolveShortcut({ key: '9', ctrlKey: true }).page, 'sessions');
  assert.equal(PAGE_ORDER.length, 14);
});

test('68 输入框内 Ctrl+数字仍生效，裸数字与 ? 不抢输入', () => {
  const input = { tagName: 'INPUT', isContentEditable: false };
  assert.equal(resolveShortcut({ key: '5', ctrlKey: true, target: input }).page, 'friendlog');
  assert.equal(resolveShortcut({ key: '5', target: input }), null);
  assert.equal(resolveShortcut({ key: '?', shiftKey: true, target: input }), null);
  assert.deepEqual(resolveShortcut({ key: '?', shiftKey: true }), { type: 'help' });
});

test('68 不干扰浏览器自带组合键', () => {
  assert.equal(resolveShortcut({ key: '1', ctrlKey: true, altKey: true }), null);
  assert.equal(resolveShortcut({ key: '0', ctrlKey: true }), null);
  assert.equal(resolveShortcut({ key: 'k', ctrlKey: true }), null);
  assert.equal(resolveShortcut(null), null);
});

const USR = 'usr_1a2b3c4d-1111-2222-3333-444455556666';
const WRLD = 'wrld_9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff';

test('69 裸 ID 与常见链接都能解析', () => {
  assert.deepEqual(parseVrcTarget(USR), { type: 'user', id: USR });
  assert.deepEqual(parseVrcTarget(` ${WRLD.toUpperCase()} `), { type: 'world', id: WRLD });
  assert.equal(parseVrcTarget(`https://vrchat.com/home/user/${USR}`).type, 'user');
  assert.equal(parseVrcTarget(`https://vrchat.com/home/world/${WRLD}`).id, WRLD);
  assert.equal(parseVrcTarget(`https://vrchat.com/home/launch?worldId=${WRLD}&instanceId=12345`).id, WRLD);
  assert.equal(parseVrcTarget(`vrchat://launch?id=${WRLD}:12345~region(jp)`).id, WRLD);
  assert.equal(parseVrcTarget(`vrcx://user/${USR}`).type, 'user');
});

test('69 普通搜索词不当 ID（不误触）', () => {
  assert.equal(parseVrcTarget('alice'), null);
  assert.equal(parseVrcTarget('usr_'), null);
  assert.equal(parseVrcTarget('usr_notauuid'), null);
  assert.equal(parseVrcTarget('https://example.com/x'), null);
  assert.equal(parseVrcTarget(''), null);
  assert.equal(parseVrcTarget(null), null);
});
