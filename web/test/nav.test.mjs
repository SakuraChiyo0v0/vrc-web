/**
 * 185 侧栏导航覆盖：PAGES（App.jsx）与 Sidebar 的 NAV 双向对齐。
 *
 * 断言两件事：
 *   1. 每个页面都能从侧栏点到（PAGES ⊆ NAV 里的页面 id + footer 设置）
 *   2. 侧栏里没有指向不存在页面的死链（NAV 页面 id ⊆ PAGES）
 * 折叠夹 id（fav / social）不是页面，必须不出现在 PAGES 里。
 *
 * 只读源码正则，不起浏览器 —— 结构性死链在这里拦，像素/密度交给 chrome_parity.mjs。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(ROOT, 'src/components/Sidebar.jsx'), 'utf8');

const pagesBlock = app.slice(app.indexOf('const PAGES = {'), app.indexOf('const TITLES = {'));
const PAGES = [...pagesBlock.matchAll(/^\s{2}(\w+):\s*lazy\(/gm)].map((m) => m[1]);
const titlesBlock = app.slice(app.indexOf('const TITLES = {'), app.indexOf('function useTheme'));
const TITLES = [...titlesBlock.matchAll(/^\s{2}(\w+):\s*\[/gm)].map((m) => m[1]);

// Sidebar：NAV 常量 + footer 内联的设置项
const navBlock = sidebar.slice(sidebar.indexOf('const NAV = ['), sidebar.indexOf('/** 固定世界'));
const navIds = [...navBlock.matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
// 折叠夹判据只看 `children:`（第 32 轮图标改矢量后 NAV 里不再有 icon 字段）
const folderIds = [...navBlock.matchAll(/id: '(\w+)',\s*\n\s*label: '[^']*',\s*\n\s*children:/g)].map((m) => m[1]);
const footerSettings = /<NavItem item=\{\{ id: '(\w+)'/.exec(sidebar)?.[1];
const navPages = [...navIds.filter((id) => !folderIds.includes(id)), footerSettings].filter(Boolean);

const uniq = (xs) => [...new Set(xs)].sort();

test('侧栏没有死链：每个导航项都能找到页面', () => {
  const dead = uniq(navPages).filter((id) => !PAGES.includes(id));
  assert.deepEqual(dead, [], `侧栏指向不存在的页面: ${dead.join(', ')}`);
});

// 工具页（真机有、我们补的入口页）把真机侧栏没有独立入口的功能收成卡片，
// 那些页面从侧栏点不到，但必须能从 #/tools 的卡片进——这里一并算可达。
const toolsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/ToolsPage.jsx'), 'utf8');
const toolLinks = [...toolsSrc.matchAll(/href=\{`#\/\$\{t\.id\}`\}/g)].length
  ? [...toolsSrc.matchAll(/id: '(\w+)'/g)].map((m) => m[1])
  : [];

test('每个页面都能从侧栏点到（或从工具页卡片进）', () => {
  const orphan = uniq(PAGES).filter((id) => !navPages.includes(id) && !toolLinks.includes(id));
  assert.deepEqual(orphan, [], `有页面没进侧栏也没进工具页: ${orphan.join(', ')}`);
});

test('折叠夹不是页面，且默认展开（真机两夹都展开）', () => {
  assert.deepEqual(uniq(folderIds), ['fav', 'social']);
  for (const id of folderIds) assert.ok(!PAGES.includes(id), `折叠夹 ${id} 不该是页面`);
  assert.match(sidebar, /const \[open, setOpen\] = useState\(true\)/);
});

test('每个页面都有标题与副标题', () => {
  assert.deepEqual(uniq(TITLES), uniq(PAGES));
});

// 侧栏文案与顺序按真机基准 docs/ref/nav-inventory.json（nav_ref_full.png 24 行 OCR 复核）。
// 像素/密度由 frame_parity 管，DOM vs 基准的逐条 diff 由 scripts/nav_inventory_check.mjs 管；
// 这条只钉住「主干顺序 + 文案」，改 NAV 时最先撞到它，防止文案悄悄漂回自造叫法。
test('侧栏主干文案与顺序 = 真机（好友动态→好友位置→…→仪表板）', () => {
  // 缩进判层级：2/4 = 顶层（折叠夹标题跨行，id 缩进 4），6 = 折叠夹子项
  const rows = [];
  let pending = null;
  for (const line of navBlock.split('\n')) {
    const idm = line.match(/^(\s*)(?:\{ )?id: '(\w+)'/);
    if (idm) { pending = { indent: idm[1].length, id: idm[2], label: null }; rows.push(pending); }
    if (pending) {
      const lm = line.match(/label: '([^']*)'/);
      if (lm) { pending.label = lm[1]; pending = null; }
    }
  }
  const tops = rows.filter((r) => r.indent <= 4);   // 折叠夹标题（缩进 4）也是顶层行
  const subsOf = (folderId) => {
    const i = rows.findIndex((r) => r.id === folderId);
    const out = [];
    for (let j = i + 1; j < rows.length && rows[j].indent === 6; j += 1) out.push(rows[j].label);
    return out;
  };
  assert.deepEqual(tops.map((r) => r.label), [
    '好友动态', '好友位置', '游戏日志', '房间历史', '房内玩家', '搜索', '浏览记录',
    '收藏', '社交', '我的模型', '活动', '好友关系图', '工具', '仪表板'
  ]);
  // 折叠夹子项：真机 收藏=好友收藏/群组收藏/世界收藏/模型收藏，社交=好友日志/好友列表/玩家管理
  assert.deepEqual(subsOf('fav'), ['好友收藏', '群组收藏', '世界收藏', '模型收藏']);
  assert.deepEqual(subsOf('social'), ['好友日志', '好友列表', '玩家管理']);
});

// 侧栏顺序是 Ctrl+数字 的依据（shortcuts.js 注释这么写，就得真的一致）
test('PAGE_ORDER 前 9 项 = 侧栏主干前 9 个页面', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/shortcuts.js'), 'utf8');
  const order = (src.match(/export const PAGE_ORDER = \[([\s\S]*?)\]/)?.[1] ?? '')
    .split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const navPagesInOrder = navBlock.match(/id: '(\w+)'/g).map((s) => s.slice(5, -1))
    .filter((id) => !folderIds.includes(id));
  assert.deepEqual(order.slice(0, 9), navPagesInOrder.slice(0, 9));
});
