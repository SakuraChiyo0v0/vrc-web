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
  // 134 起页面按路由分 chunk：断言要在全部产物里找，只读第一个文件会漏
  const files = fs.readdirSync(distDir).filter((x) => x.endsWith(ext));
  if (!files.length) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return files.map((f) => fs.readFileSync(path.join(distDir, f), 'utf8')).join('\n');
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

  /* ───── 94 游戏日志 / 好友日志时间轴：日期粘性分组 + 世界内玩家加入/离开 ───── */
  await check(94, '日志时间轴：日期头粘顶，世界内按玩家加入/离开嵌套', async () => {
    const gl = read('web/src/pages/GameLogPage.jsx');
    must(gl.includes('gl-dayhead') && gl.includes('data-date={d.date}'), '游戏日志日期头没有粘性分组标记');
    must(gl.includes('gl-evlist') && /data-k=\{ev\.kind\}/.test(gl), '游戏日志没有加入/离开时间轴');
    must(/kind === 'leave' \? '离开' : '加入'/.test(gl), '时间轴没有区分加入/离开文案');
    must(gl.includes('v.events?.length'), '时间轴没有读服务端 events');
    const r7 = read('server/src/routes/round7.js');
    must(r7.includes("'room_leave'") && r7.includes('event_count'), '服务端 game-log/days 没有 room_leave / event_count');
    must(js.includes('gl-dayhead') && js.includes('gl-evlist'), '构建产物缺时间轴');
    must(/\.gl-dayhead\s*\{[^}]*position:\s*sticky/.test(css), 'CSS 缺 .gl-dayhead 粘性日期头');
    must(/\.gl-ev\[data-k=['"]?join['"]?\]/.test(css), 'CSS 缺加入/离开着色');
    return '日期头 sticky + 每次停留内 join/leave 时间轴';
  });

  /* ───── 95 长列表粘性分组头 + 行 hover ───── */
  await check(95, '长列表按日分组、日期头滚动贴顶、行 hover', async () => {
    const fl = read('web/src/pages/FriendLogPage.jsx');
    must(fl.includes('dayhead') && /data-day=\{g\.key\}/.test(fl), '好友日志日期头没有粘性分组');
    must(fl.includes("toLocaleDateString('sv-SE'"), '好友日志没有按 +08 切日');
    must(fl.includes('friend-row'), '好友日志行没有 friend-row（hover 来源）');
    must(/\.dayhead\s*\{[^}]*position:\s*sticky/.test(css), 'CSS 缺 .dayhead 粘性分组头');
    must(/\.friend-row:hover\s*\{[^}]*background:\s*var\(--state-hover-surface\)/.test(css), 'CSS 缺 .friend-row hover');
    must(js.includes('dayhead'), '构建产物缺粘性分组头');
    return '好友日志按日分组 + 粘性头 + 行 hover';
  });

  /* ───── 96 键盘上下选择：↑↓ 移动高亮，Enter 开抽屉，Esc 关 ───── */
  await check(96, '键盘 ↑↓ 在列表内移动高亮，Enter 打开，Esc 关闭', async () => {
    const lib = read('web/src/lib/listnav.js');
    must(/ArrowDown/.test(lib) && /ArrowUp/.test(lib), 'listnav 没有方向键');
    must(lib.includes("'Enter'") && lib.includes('onEnter'), 'listnav 没有 Enter 打开');
    must(lib.includes('Escape'), 'listnav 没有 Esc 关闭');
    must(lib.includes('isContentEditable') && lib.includes('textarea'), '输入框里没有屏蔽方向键');
    must(lib.includes('scrollIntoView'), '高亮行没有滚进可视区');
    must(read('web/src/pages/FeedPage.jsx').includes('useListNav'), '动态页没有接键盘选择');
    must(read('web/src/pages/PlayersPage.jsx').includes('useListNav'), '玩家页没有接键盘选择');
    must(js.includes('data-nav-idx') && js.includes('data-nav-active'), '构建产物缺键盘高亮标记');
    must(/\[data-nav-active=['"]?true['"]?\][^{]*\{[^}]*state-selected-surface/.test(css), 'CSS 缺键盘高亮');
    return '↑↓ 移动 + Enter 开抽屉 + Esc 关；输入框内不抢键';
  });

  /* ───── 97 条目右键菜单：复制名字 / 打开资料 / 加收藏 ───── */
  await check(97, '右键行出现菜单（复制名字 / 打开资料 / 加收藏）', async () => {
    const rm = read('web/src/components/RowMenu.jsx');
    must(rm.includes('复制名字') && rm.includes('打开资料') && rm.includes('加收藏'), '菜单项不全');
    must(rm.includes("send('favorites', 'POST'") && rm.includes("kind: 'friend'"), '加收藏没有打 favorites');
    must(rm.includes('clipboard.writeText'), '复制名字没有走剪贴板');
    must(rm.includes("e.key === 'Escape'") && rm.includes('pointerdown'), '菜单没有 Esc/点外部关闭');
    const pages = ['FeedPage', 'PlayersPage'].map((p) => read(`web/src/pages/${p}.jsx`));
    must(pages.every((s) => s.includes('onContextMenu=')), '动态/玩家行没有 onContextMenu');
    must(pages.every((s) => s.includes('friendItems(')), '页面没有用统一菜单项');
    must(js.includes('data-rowmenu') && js.includes('rowmenu-item'), '构建产物缺右键菜单');
    must(/\.rowmenu\s*\{[^}]*position:\s*fixed/.test(css), 'CSS 缺 .rowmenu 定位');
    return '右键菜单：复制名字 / 打开资料 / 加收藏 + 贴边翻转 + Esc 关闭';
  });

  /* ───── 98 空态统一：同一个 <Empty>（图标 + 一行说明），无裸文字空态 ───── */
  await check(98, '全站空态统一用 <Empty>（图标 + 一行说明）', async () => {
    const dir = 'web/src/pages/';
    const pages = ['SessionsPage', 'NotificationsPage', 'FeedPage', 'WorldsPage', 'PlayersPage', 'FavoritesPage', 'GameLogPage', 'FriendLogPage', 'InsightsPage', 'StatsPage', 'OverviewPage'];
    const bare = [];
    for (const p of pages) {
      const src = read(`${dir}${p}.jsx`);
      if (!src.includes("from '../components/Empty.jsx'")) bare.push(`${p}: 没引 <Empty>`);
      if (src.includes('p-10 text-center')) bare.push(`${p}: 还有旧的 card p-10 空态`);
    }
    must(!bare.length, bare.join('；'));
    must(read('web/src/components/Empty.jsx').includes('data-empty="1"'), '<Empty> 没有 data-empty 标记');
    must(/\.empty\s*\{[^}]*align-items:\s*center/.test(css), 'CSS 缺 .empty 布局');
    must(js.includes('data-empty'), '构建产物缺 <Empty>');
    return `${pages.length} 页空态统一；图标 + 标题 + 副文案，compact 版用于卡片内`;
  });

  /* ───── 99 首屏骨架：列表加载时占位行（不白屏、不跳高） ───── */
  await check(99, '首屏加载显示骨架行（不是「加载中…」白屏）', async () => {
    const sk = read('web/src/components/Skeleton.jsx');
    must(sk.includes('data-skeleton="1"') && sk.includes('aria-busy'), '<Skeleton> 没有骨架标记');
    must(/height:\s*44px/.test(css) && /\.sk-row\s*\{/.test(css), 'CSS 缺 44px 骨架行');
    must(/@keyframes\s+sk-shimmer/.test(css), 'CSS 缺骨架微光动画');
    must(/prefers-reduced-motion[^}]*\.sk-bar\s*\{[^}]*animation:\s*none/.test(css), '没有尊重减动效设置');
    const pages = ['FeedPage', 'FriendsPage', 'FriendListPage', 'FriendLogPage'];
    const bad = pages.filter((p) => {
      const s = read(`web/src/pages/${p}.jsx`);
      return !s.includes("from '../components/Skeleton.jsx'") || /加载中…<\/div>/.test(s);
    });
    must(!bad.length, `${bad.join('、')} 还在用「加载中…」文字占位`);
    must(js.includes('data-skeleton') && js.includes('sk-bar'), '构建产物缺骨架');
    return `${pages.length} 个首屏列表用骨架行；44px 对齐表格行高`;
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
