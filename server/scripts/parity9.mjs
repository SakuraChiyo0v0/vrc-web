/**
 * 第九轮对齐检查（docs/vrcx0-parity.md 92~99）。
 *   node server/scripts/parity9.mjs      # 读构建产物 + 源码，退出码 0 为全绿
 *
 * 前端项断言构建产物（先 `cd web && npm run build`）。
 * 未实现的项不注册 check，结束时按 IMPLEMENTED 计数输出 PARTIAL，全部 8 项齐了才是 PARITY9 OK。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist/assets');
const asset = (ext) => {
  if (!fs.existsSync(distDir)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  const f = fs.readdirSync(distDir).find((x) => x.endsWith(ext));
  if (!f) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(distDir, f), 'utf8');
};

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/* 已实现的项数：每轮补齐后改这个数（8 = 全部） */
const TOTAL_ITEMS = 8;

let exitCode = 1;
try {
  const css = asset('.css');
  const js = asset('.js');

  /* ───── 92 概览 / 旅程双视图：旅程按月分组显示每日时长 ───── */
  await check(92, '概览/旅程双 tab，旅程按月分组显示每日时长', async () => {
    const src = read('web/src/pages/OverviewPage.jsx');
    must(/data-tab=\{k\}/.test(src) && src.includes("['journey', '旅程']"), '源码没有「概览/旅程」两个 tab');
    must(/slice\(0, 7\)/.test(src), '旅程没有按 YYYY-MM 分组（slice(0,7)）');
    must(/data-month=\{g\.key\}/.test(src), '月份分组没有 data-month 标记');
    must(src.includes('jm-daybar') && src.includes('jm-dayrow'), '旅程缺每日时长行/条');
    must(/game-log\/days\?days=\$\{jDays\}/.test(src), '旅程没有跟时间范围取 game-log/days');
    must(js.includes('data-month') && js.includes('jm-daybar'), '构建产物缺旅程月分组/日时长条');
    must(/\.jm-head\s*\{[^}]*position:\s*sticky/.test(css), 'CSS 缺 .jm-head 粘性月头');
    must(/\.jm-daybar\s*\{[^}]*height:\s*6px/.test(css), 'CSS 缺 .jm-daybar 时长条');
    return '概览/旅程可切；旅程 = 月分组 + 每日时长条 + 点开当天逐次停留';
  });

  /* ───── 93 右栏可折叠 + 拖宽记忆 ───── */
  await check(93, '右栏可拖宽（200–420）并记忆，折叠成 40px 竖条', async () => {
    const src = read('web/src/components/RosterPanel.jsx');
    must(/MIN_W = 200/.test(src) && /MAX_W = 420/.test(src), '源码缺拖宽上下限 200/420');
    must(src.includes("vrc-roster-w"), '宽度没有写进 localStorage（vrc-roster-w）');
    must(/window\.innerWidth - e\.clientX/.test(src), '拖宽没有按视口右边缘计算');
    must(/onPointerDown=/.test(src) && src.includes('roster-resize'), '缺拖动手柄');
    must(js.includes('roster-resize') && js.includes('vrc-roster-w'), '构建产物缺拖宽手柄/宽度记忆');
    must(/\.roster-resize\s*\{[^}]*col-resize/.test(css), 'CSS 缺 .roster-resize col-resize');
    must(/\.roster-rail\[data-collapsed=['"]?true['"]?\]\s*\{[^}]*width:\s*40px/.test(css), '折叠竖条不是 40px');
    return '拖动改宽 + localStorage 记忆 + 双击复位；折叠 40px';
  });

  const ok = results.filter((r) => r.ok).length;
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.ok ? ` — ${r.detail}` : `\n       ${r.detail}`}`);
  const done = results.length >= TOTAL_ITEMS && ok === TOTAL_ITEMS;
  console.log(`\n${done ? 'PARITY9 OK' : 'PARITY9 PARTIAL'} ${ok}/${results.length}（目标 ${TOTAL_ITEMS} 项，剩 ${TOTAL_ITEMS - results.length} 项未做）`);
  exitCode = done ? 0 : 1;
} catch (e) {
  console.error(`PARITY9 ERROR ${e.stack || e.message}`);
}
process.exit(exitCode);
