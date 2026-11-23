/** 分栏对齐口径：基准截图里的「好友收藏」栏是数据相关项，账号没收藏好友时不该要求它 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataDependentWant } from '../../scripts/lib/page_structure.mjs';

const want = { groups: ['好友收藏', '其他在线好友', '位于私人房间'] };

test('无收藏好友时去掉「好友收藏」栏', () => {
  const w = dataDependentWant('locations', want, { facets: { favorite: 0 } });
  assert.deepEqual(w.groups, ['其他在线好友', '位于私人房间']);
  assert.deepEqual(want.groups, ['好友收藏', '其他在线好友', '位于私人房间'], '不得改基准对象');
});

test('有收藏好友时保留全部分栏', () => {
  const w = dataDependentWant('locations', want, { facets: { favorite: 2 } });
  assert.equal(w.groups, want.groups);
});

test('其他页面不受影响', () => {
  const other = { groups: ['好友收藏', 'X'] };
  assert.equal(dataDependentWant('feed', other, { facets: { favorite: 0 } }), other);
});
