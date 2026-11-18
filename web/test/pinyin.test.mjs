import assert from 'node:assert/strict';
import test from 'node:test';
import { initialOf, initialsOf, matchText, searchKey } from '../src/lib/pinyin.js';

test('单个汉字首字母', () => {
  assert.equal(initialOf('小'), 'x');
  assert.equal(initialOf('红'), 'h');
  assert.equal(initialOf('马'), 'm');
  assert.equal(initialOf('a'), '');      // 非汉字不参与
});

test('首字母键：汉字换首字母，ascii 原样小写', () => {
  assert.equal(initialsOf('小红'), 'xh');
  assert.equal(initialsOf('马伏宇'), 'mfy');
  assert.equal(searchKey('Ame小红'), 'amexh');
  assert.equal(searchKey('SakuraChiyoQAQ'), 'sakurachiyoqaq');
  assert.equal(searchKey(null), '');
});

test('matchText：拼音首字母能命中中文名', () => {
  assert.equal(matchText('小红', 'xh'), true);
  assert.equal(matchText('小红', 'XH'), true);
  assert.equal(matchText('小红', 'hong'), false);   // 只做首字母
  assert.equal(matchText('马伏宇', 'mfy'), true);
  assert.equal(matchText('Ame小红', 'amexh'), true);
  assert.equal(matchText('Ame小红', '小红'), true);  // 原文包含仍然有效
  assert.equal(matchText('小红', 'xxh'), false);
  assert.equal(matchText('小红', ''), true);
  assert.equal(matchText(null, 'xh'), false);
});
