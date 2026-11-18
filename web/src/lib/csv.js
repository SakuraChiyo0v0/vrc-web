/**
 * 103 导出跟随筛选：CSV 直接从「页面上正在显示的行」生成，行数天然和页面计数一致。
 *
 *   const { text, rows } = toCsv(cols, list);   // cols = [{ key, label }] 或 ['key']
 *   downloadCsv('vrc-friends-2026-11-18.csv', text);
 *
 * 纯函数部分（toCsv）在 node 里可直接测；downloadCsv 只在浏览器里调用。
 */

/** 单元格：引号/逗号/换行/前后空格都要包起来；null → 空串 */
export const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const norm = (cols) => cols.map((c) => (typeof c === 'string' ? { key: c, label: c } : c));

/**
 * @param {Array<string|{key:string,label:string}>} cols
 * @param {Array<object>} rows 已经筛选、排序过的行（与页面同一份数组）
 * @returns {{ text: string, rows: number }}
 */
export function toCsv(cols, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const cs = norm(cols ?? []);
  const head = cs.map((c) => csvCell(c.label)).join(',');
  const body = list.map((r) => cs.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  // BOM 让 Excel 直接按 UTF-8 打开，中文不乱码
  return { text: `\ufeff${[head, ...body].join('\n')}\n`, rows: list.length };
}

/** 文件名带日期，下载多个筛选结果不会互相覆盖 */
export function csvFilename(name, at = new Date()) {
  const d = new Date(at.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  return `vrc-${name}-${d}.csv`;
}

/** 浏览器侧：Blob 下载（不请求服务端，筛选条件不会丢） */
export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
