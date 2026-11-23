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
const folderIds = [...navBlock.matchAll(/id: '(\w+)',\s*\n\s*label: '[^']*',\s*\n\s*icon: '[^']*',\s*\n\s*children:/g)].map((m) => m[1]);
const footerSettings = /<NavItem item=\{\{ id: '(\w+)'/.exec(sidebar)?.[1];
const navPages = [...navIds.filter((id) => !folderIds.includes(id)), footerSettings].filter(Boolean);

const uniq = (xs) => [...new Set(xs)].sort();

test('侧栏没有死链：每个导航项都能找到页面', () => {
  const dead = uniq(navPages).filter((id) => !PAGES.includes(id));
  assert.deepEqual(dead, [], `侧栏指向不存在的页面: ${dead.join(', ')}`);
});

test('每个页面都能从侧栏点到', () => {
  const orphan = uniq(PAGES).filter((id) => !navPages.includes(id));
  assert.deepEqual(orphan, [], `有页面没进侧栏: ${orphan.join(', ')}`);
});

test('折叠夹不是页面，且默认展开（真机两夹都展开）', () => {
  assert.deepEqual(uniq(folderIds), ['fav', 'social']);
  for (const id of folderIds) assert.ok(!PAGES.includes(id), `折叠夹 ${id} 不该是页面`);
  assert.match(sidebar, /const \[open, setOpen\] = useState\(true\)/);
});

test('每个页面都有标题与副标题', () => {
  assert.deepEqual(uniq(TITLES), uniq(PAGES));
});
