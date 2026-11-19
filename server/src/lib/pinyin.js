/**
 * 105 中文名拼音首字母搜索：输入 `xh` 能命中「小红」。
 *
 *   searchKey('Ame小红')  → 'amexh'      // ascii 原样小写，汉字换成首字母
 *   matchText('小红', 'xh') → true
 *   matchText('小红', 'hong') → false    // 只做首字母，不做全拼
 *
 * 表来自 pinyinTable.js（构建期生成，20KB），运行时只是 indexOf，没有词典依赖。
 */
import { PINYIN_INITIALS, PINYIN_START } from './pinyinTable.js';

const END = PINYIN_START + PINYIN_INITIALS.length;

/** 单个汉字的首字母；表外字符（生僻扩展区/符号）返回空串 */
export const initialOf = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp < PINYIN_START || cp >= END) return '';
  const c = PINYIN_INITIALS[cp - PINYIN_START];
  return c === '-' ? '' : c;
};

/** 搜索用的归一化键：小写 + 汉字首字母 */
export function searchKey(name) {
  if (name === null || name === undefined) return '';
  let out = '';
  for (const ch of String(name)) {
    const cp = ch.codePointAt(0);
    if (cp >= PINYIN_START && cp < END) {
      out += initialOf(ch);
    } else {
      out += ch.toLowerCase();
    }
  }
  return out;
}

/** 只取汉字部分的首字母串（给「拼音：xh」这类提示用） */
export const initialsOf = (name) =>
  [...String(name ?? '')].map(initialOf).join('');

/**
 * 名字是否命中查询：
 *   1. 原文不区分大小写包含（原来的行为）
 *   2. 首字母键包含查询（`xh` → 小红，`amexh` → Ame小红）
 * 空白查询恒为 true。
 */
export function matchText(name, q) {
  const query = String(q ?? '').trim().toLowerCase();
  if (!query) return true;
  const text = String(name ?? '').toLowerCase();
  if (text.includes(query)) return true;
  return searchKey(name).includes(query);
}
