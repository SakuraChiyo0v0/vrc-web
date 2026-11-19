/**
 * 第十二轮对齐检查（docs/vrcx0-parity.md 121~126：好友详情重构 + 性能收口）。
 *   node server/scripts/parity12.mjs      # 退出码 0 = 全绿
 *
 * 121~124 断言源码 + 构建产物（先 `cd web && npm run build`）；125 起子进程跑 perf12.mjs；
 * 126 用临时 SQLite 空库开一次，查 7 个索引是否由 DDL 自动建出来。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

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

const TOTAL_ITEMS = 6;
const DRAWER = 'web/src/components/FriendDrawer.jsx';
const CSS = 'web/src/styles.css';

let exitCode = 1;
try {
  const js = asset('.js');
  const css = asset('.css');
  const drawer = read(DRAWER);

  /* ───── 121 抽屉头部 ───── */
  await check(121, '抽屉头部 80px 头像 + 状态点 + 平台/信任徽章（不露原文）', async () => {
    must(drawer.includes('data-head'), '抽屉缺 data-head 头部标记');
    must(/drawer-avatar[^>]*width: 80, height: 80/.test(drawer) || /style=\{\{ width: 80, height: 80 \}\}/.test(drawer), '头像没写死 80px');
    must(css.includes('.drawer-head') && css.includes('.drawer-avatar'), 'styles.css 缺 .drawer-head/.drawer-avatar');
    must(/\.drawer-avatar[^}]*width:\s*8[0-9]px/s.test(css), 'CSS 里头像尺寸 <80px');

    // 平台/信任徽章：映射表 + 徽章色走 --status-*
    must(drawer.includes('standalonewindows: \'PC\'') || drawer.includes("standalonewindows: 'PC'"), '平台原文没有映射成 PC');
    must(/'Quest'/.test(drawer), '平台映射缺 Quest');
    must(drawer.includes('system_trust_trusted'), '信任等级映射缺失');
    must(/datum|data-badge|badge/.test(drawer), '没有徽章标记');
    must(/--status-/.test(css), '徽章色没有走 --status-* 变量');
    // 渲染文本里不能再直接打印原文
    must(!/\{p\?\.platform\}/.test(drawer), '还在直接渲染 platform 原文');
    // 构建产物里也要有映射（防止改了源码没构建）
    must(js.includes('Quest'), '构建产物缺平台映射（没重新 build？）');
    return '头像 80px、平台 PC/Quest、信任徽章带色';
  });

  /* ───── 122 操作行 ───── */
  await check(122, '复制主页链接 / 收藏 / 复制世界链接 三键可用', async () => {
    must(drawer.includes('data-act="copy-profile"'), '缺复制主页链接按钮');
    must(drawer.includes('data-act="favorite"'), '缺收藏按钮');
    must(drawer.includes('data-act="copy-world"'), '缺复制世界链接按钮');
    must(drawer.includes('vrchat.com/home/user/'), '复制的不是 VRChat 主页链接');
    must(drawer.includes('vrchat.com/home/world/'), '复制的不是 VRChat 世界链接');
    must(/send\(`favorites\/\$\{fav\.id\}`, 'DELETE'\)/.test(drawer) && drawer.includes("send('favorites', 'POST'"), '收藏没走 POST/DELETE /api/favorites');
    must(drawer.includes('copyText') && /execCommand\('copy'\)/.test(drawer), '复制缺 http 兜底（execCommand）');
    must(js.includes('favorites') && js.includes('已复制'), '构建产物缺收藏/复制逻辑');
    return '三键 + clipboard 兜底 + /api/favorites POST/DELETE';
  });

  /* ───── 123 四个真实 tab ───── */
  await check(123, '概览/足迹/数据/备注 四 tab，概览不再塞事件流', async () => {
    for (const t of ['overview', 'trips', 'data', 'notes']) {
      must(drawer.includes(`data-panel="${t}"`), `缺 data-panel=${t}`);
      must(drawer.includes(`data-tab="${t}"`) || drawer.includes(`key="${t}"`), `缺 tab 按钮 ${t}`);
    }
    // 四个面板各自渲染不同组件：概览=统计卡、足迹=Footprints、数据=常一起出现、备注=NoteAndTags
    const panels = drawer.split('data-panel=').slice(1);
    must(panels.length >= 4, '面板数量不足 4');
    must(/data-panel="overview"[\s\S]{0,900}<Footprints/.test(drawer) === false, '概览面板里塞了足迹/事件流');
    must(/data-panel="trips"[\s\S]{0,300}<Footprints/.test(drawer), '足迹面板没渲染 Footprints');
    must(/data-panel="notes"[\s\S]{0,300}NoteAndTags/.test(drawer), '备注面板没渲染 NoteAndTags');
    must(drawer.includes('role="tablist"') && drawer.includes('role="tab"'), '缺 tablist/tab 无障碍角色');
    return '四 panel 各自组件，overview 无 Footprints';
  });

  /* ───── 124 去重 + 折叠 ───── */
  await check(124, '足迹默认折叠、只留最近 10 条、过滤 type=event', async () => {
    must(drawer.includes('data-footprints'), '缺 data-footprints 区块');
    must(/useState\(false\)/.test(drawer), '足迹没有默认折叠状态');
    must(drawer.includes('aria-expanded'), '折叠按钮缺 aria-expanded');
    must(/slice\(0,\s*10\)/.test(drawer), '足迹没有截到最近 10 条');
    must(/kind\s*!==\s*'event'|kind\s*===?\s*'event'/.test(drawer), '足迹没有过滤 event 类型（与动态页去重）');
    return '默认折叠 + 最近 10 条 + 过滤 event';
  });

  /* ───── 125 性能（子进程跑 perf12，连续 3 次都达标）───── */
  await check(125, '搜索 <100ms、friend-log <200ms（连续 3 次）', async () => {
    const out = await new Promise((res) => {
      let log = '';
      const p = spawn(process.execPath, ['scripts/perf12.mjs'], { cwd: new URL('..', import.meta.url).pathname });
      p.stdout.on('data', (d) => { log += d; });
      p.stderr.on('data', (d) => { log += d; });
      p.on('close', (code) => res({ code, log }));
    });
    const s = out.log.match(/PERF12 search=([\d/]+)ms[^\n]*/);
    const f = out.log.match(/PERF12 friend-log=([\d/]+)ms[^\n]*/);
    must(out.code === 0, `perf12 未通过：${out.log.split('\n').filter(Boolean).slice(-3).join(' | ')}`);
    must(s && f, 'perf12 没输出两行计时');
    must(s[1].split('/').length === 3 && f[1].split('/').length === 3, '不是连续 3 次取样');
    return `search ${s[1]}ms / friend-log ${f[1]}ms`;
  });

  /* ───── 126 索引随 DDL 落地 ───── */
  await check(126, '新库自动建 7 个查询索引', async () => {
    const file = path.join(os.tmpdir(), `vrc-parity12-${Date.now()}.db`);
    const db = await openDb(`sqlite:${file}`);
    let rows;
    try {
      rows = await db.query("select name from sqlite_master where type='index' and name not like 'sqlite_%'");
      const names = rows.map((r) => r.name);
      const want = [
        'friend_event_kind_at', 'friend_change_at', 'friend_status_at',
        'game_event_kind_at', 'game_event_user_at',
        'friend_session_started', 'friend_visit_started',
      ];
      for (const w of want) must(names.includes(w), `缺索引 ${w}`);
      const [n] = await db.query("select count(*) as n from sqlite_master where type='index' and name not like 'sqlite_%'");
      must(Number(n.n) >= 20, `索引总数偏少：${n.n}`);
      // DDL 与源码同源：schema.js 里也能查到
      const schema = read('server/src/db/schema.js');
      for (const w of want) must(schema.includes(w), `schema.js 缺 ${w}`);
      return `${want.length} 个新索引 OK（总 ${n.n}）`;
    } finally {
      await db.close();
      for (const f of [file, `${file}-wal`, `${file}-shm`]) { try { fs.unlinkSync(f); } catch {} }
    }
  });

  const okCount = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}${r.ok ? '' : `\n     ${r.detail}`}`);
  }
  console.log(`\nPARITY12 ${okCount === TOTAL_ITEMS ? 'OK' : 'PARTIAL'} ${okCount}/${TOTAL_ITEMS}`);
  exitCode = okCount === TOTAL_ITEMS ? 0 : 1;
} catch (e) {
  console.log(`PARITY12 FAIL ${e.stack || e.message}`);
}
process.exit(exitCode);
