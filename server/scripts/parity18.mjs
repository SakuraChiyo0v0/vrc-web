/**
 * 第十八轮对齐检查（抽屉数据图表 + 旅程折叠/可点）。
 *   node server/scripts/parity18.mjs      # 退出码 0 = 全绿（先 cd web && npm run build）
 *
 * 181 抽屉「数据」tab：/api/friend/:id/daily 提供逐日时长 + 24 小时分布；UI 有 30 根日柱、常去世界横条、7×24 热力图
 * 182 概览旅程：按月分组、默认只展开最新月、月头可折叠；概览每日柱点击 → 旅程对应那天自动展开
 * 183 聚合自洽：daily 连续 30 天、daily 之和 = total_minutes、hours 之和 ≈ total（四舍五入误差 ≤1 分钟/小时格）
 * 184 回归：web 单元测试全绿
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const PORT = Number(process.env.PARITY18_PORT ?? 8897);
const BASE = `http://127.0.0.1:${PORT}`;
const TPL = '/opt/data/cache/hermes-daily-template';

const results = [];
const check = async (id, name, fn) => {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const run = (cmd, args, opts = {}) => new Promise((res) => {
  let log = '';
  const p = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...(opts.env ?? {}) } });
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  p.on('close', (code) => res({ code, log }));
});

const waitFor = async (fn, ms = 60_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const v = await fn(); if (v) return v; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
};

let demo = null;
const api = async (p) => {
  const r = await fetch(`${BASE}/api/${p}`);
  must(r.ok, `GET /api/${p} → ${r.status}`);
  return r.json();
};

let exitCode = 1;
try {
  must(await import('node:fs').then((fs) => fs.existsSync(path.join(ROOT, 'web/dist/index.html'))), 'web/dist 不存在（先跑 cd web && npm run build）');

  demo = spawn(process.execPath, ['scripts/demo.mjs', String(PORT)], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, DEMO_SPAN: '1' }, // 182：补 30~100 天前的停留，才有两个月份可折叠
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let demoLog = '';
  demo.stdout.on('data', (d) => { demoLog += d; });
  demo.stderr.on('data', (d) => { demoLog += d; });
  const ready = await waitFor(async () => (await fetch(`${BASE}/api/roster`)).ok, 60_000);
  must(ready, `demo 没起来：${demoLog.split('\n').slice(-5).join(' | ')}`);

  /* ───── 181 API：逐日时长 + 时段分布 ───── */
  await check(181, '/api/friend/:id/daily 逐日 30 天 + 24 小时分布', async () => {
    const d = await api('friend/usr_alice/daily?days=30');
    must(Array.isArray(d.daily) && d.daily.length === 30, `daily 长度 ${d.daily?.length} ≠ 30`);
    must(Array.isArray(d.hours) && d.hours.length === 24, `hours 长度 ${d.hours?.length} ≠ 24`);
    const dates = d.daily.map((x) => x.date);
    must(new Set(dates).size === 30, 'daily 里有重复日期');
    must(dates.every((x, i) => i === 0 || x > dates[i - 1]), 'daily 日期没有按天递增');
    must(d.daily.every((x) => Number.isInteger(x.minutes) && x.minutes >= 0), 'daily.minutes 不是非负整数');
    must(d.total_minutes > 0 && d.active_days > 0, '演示库里没有在线时长');
    must(d.peak && d.peak.hour >= 0 && d.peak.hour < 24, 'peak 小时缺失');
    return `${d.days} 天 · 合计 ${d.total_minutes} 分钟 · 峰值 ${d.peak.hour}:00 · 活跃 ${d.active_days} 天`;
  });

  await check(183, '聚合自洽：daily 之和 = total_minutes，hours 之和 ≈ total', async () => {
    const d = await api('friend/usr_alice/daily?days=30');
    const sumDaily = d.daily.reduce((a, x) => a + x.minutes, 0);
    must(sumDaily === d.total_minutes, `daily 之和 ${sumDaily} ≠ total ${d.total_minutes}`);
    const sumHours = d.hours.reduce((a, x) => a + x, 0);
    must(Math.abs(sumHours - d.total_minutes) <= 24, `hours 之和 ${sumHours} 偏离 total ${d.total_minutes} 超过 24 分钟（逐小时四舍五入）`);
    const hm = await api('friend/usr_alice/heatmap');
    must(hm.hourly?.length === 7 && hm.hourly.every((r) => r.length === 24), 'heatmap 不是 7×24');
    const w = await api('friend/usr_alice/worlds');
    const visits = w.worlds.map((x) => x.visits);
    must(visits.every((v, i) => i === 0 || visits[i - 1] >= v), 'worlds 没有按次数降序');
    return `daily=${sumDaily}min hours=${sumHours}min heatmap=7×24 worlds=${w.returned} 个`;
  });

  /* ───── 182 UI：抽屉图表 + 旅程折叠/可点 ───── */
  await check(182, 'UI 实测：数据 tab 三图齐全 + 旅程按月折叠 + 每日柱可点', async () => {
    const fs = await import('node:fs');
    must(fs.existsSync(path.join(TPL, 'node_modules/playwright')), '没有 playwright（模板目录缺失），UI 无法实测');
    fs.copyFileSync(path.join(ROOT, 'scripts/parity18_ui.mjs'), path.join(TPL, '.parity18_ui.mjs'));
    const r = await run(process.execPath, ['.parity18_ui.mjs', BASE], { cwd: TPL, env: { VRC_ROOT: ROOT } });
    const lines = r.log.split('\n').filter((l) => l.startsWith('PARITY18UI'));
    const ok = lines.filter((l) => l.includes(' OK ')).length;
    const fail = lines.filter((l) => !l.includes(' OK '));
    must(r.code === 0 && fail.length === 0, `${fail.length} 项失败：${fail.map((l) => l.replace('PARITY18UI FAIL ', '')).join(' | ')}`);
    must(ok >= 10, `只拿到 ${ok} 项 UI 判定，覆盖不足`);
    return `${ok} 项全过（${lines.map((l) => l.split('PARITY18UI OK ')[1]?.split(' · ')[0]).filter(Boolean).slice(0, 4).join(' / ')}…）`;
  });

  /* ───── 184 web 单测回归 ───── */
  await check(184, 'web 单元测试（含 journey 纯函数）全绿', async () => {
    const r = await run('npm', ['test'], { cwd: path.join(ROOT, 'web') });
    const pass = r.log.match(/# pass (\d+)/)?.[1] ?? r.log.match(/ℹ pass (\d+)/)?.[1];
    const fail = r.log.match(/# fail (\d+)/)?.[1] ?? r.log.match(/ℹ fail (\d+)/)?.[1];
    must(r.code === 0, `npm test 退出码 ${r.code}`);
    must(Number(pass) >= 36 && Number(fail) === 0, `pass=${pass} fail=${fail}`);
    return `${pass} pass / ${fail} fail`;
  });

  exitCode = results.every((r) => r.ok) ? 0 : 1;
} catch (e) {
  console.error(`PARITY18 初始化失败：${e.message}`);
} finally {
  demo?.kill('SIGTERM');
}

for (const r of results) console.log(`PARITY18 ${r.ok ? 'OK ' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const ok = results.filter((r) => r.ok).length;
console.log(`PARITY18 ${ok}/${results.length} 通过`);
process.exit(exitCode);
