import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnline } from '../src/routes/round7.js';

// 真机「在线 12」= 世界栏 2 + 好友收藏 1 + 其他在线 6 + 位于私人房间 3：
// 私人房间的人还在 VRChat 里，必须计入在线；只有 'offline' 是真离线。
test('presence：private / traveling 算在线，offline 与空值不算', () => {
  assert.equal(isOnline('wrld_a:1~region(jp)'), true);
  assert.equal(isOnline('private'), true);
  assert.equal(isOnline('private(wrld_a:1)'), true);
  assert.equal(isOnline('traveling'), true);
  assert.equal(isOnline('offline'), false);
  assert.equal(isOnline(null), false);
  assert.equal(isOnline(''), false);
});
