/**
 * 生成 web/src/lib/pinyinTable.js：基本汉字区 U+4E00~U+9FFF 的拼音首字母查表。
 *
 *   node scripts/gen-pinyin-table.mjs      # pinyin-pro 只在这里用，运行时零依赖
 *
 * 打包方式：表是一串等长字符，第 i 个字符对应码位 0x4E00+i 的首字母，`-` 表示没有读音。
 * 约 21KB，构建后跟着 JS 走，浏览器端只做 indexOf，不需要 1.2MB 的词典。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pinyin } from 'pinyin-pro';

const START = 0x4e00;
const END = 0x9fff;
const out = [];

for (let cp = START; cp <= END; cp += 1) {
  const ch = String.fromCodePoint(cp);
  let first = '-';
  try {
    const got = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' });
    if (got.length === 1 && /^[a-z]$/.test(got[0])) first = got[0];
  } catch { /* 没有读音的码位保持 '-' */ }
  out.push(first);
}

const table = out.join('');
const file = path.join(import.meta.dirname, '..', 'src', 'lib', 'pinyinTable.js');
const body = `/**
 * 自动生成，不要手改：web/scripts/gen-pinyin-table.mjs
 * 基本汉字区 U+4E00~U+9FFF 的拼音首字母，'-' 表示无读音。
 */
export const PINYIN_START = 0x${START.toString(16)};
export const PINYIN_INITIALS = '${table}';
`;
fs.writeFileSync(file, body);

const known = [...table].filter((c) => c !== '-').length;
console.log(`wrote ${path.relative(process.cwd(), file)} — ${table.length} 码位，${known} 个有首字母，${(body.length / 1024).toFixed(1)}KB`);
