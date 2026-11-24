/**
 * 185 导航可达性真机断言：逐个点侧栏项，确认页面真的切过去、标题对得上、没蹦错误边界。
 *
 *   node scripts/nav_coverage.mjs [baseUrl]
 *
 * 视口：默认 4 个桌面档 1688×1028 / 1366×768 / 1100×800 / 1024×768（矮窗下侧栏靠滚动，
 * 所以每项先 scrollIntoView 做**命中测试**：中心点 elementFromPoint 落在该项自己身上，
 * 且整行落在 <nav> 可视区内 —— 防「JS click 能过、人点不到」）。
 *   NAV_VIEWS=all                 → frame_parity 的 9 个视口（含 600 高两档）
 *   NAV_VIEWS=1688x1028,1440x900  → 自定义
 *
 * 主题：每档视口默认跑浅色 + 深色两态（vrc-theme 存 localStorage）。主题只改色，
 * 「点得到 + 标题对 + 折叠夹/收起按钮可用」在深色下也得成立；NAV_THEME=light|dark 只跑一态。
 *
 * 折叠夹：收起后子项必须真的不可点（不在 DOM、旧坐标处 elementFromPoint 也不命中它），
 * 展开回来子项要过命中测试且点下去真换到那一页（此前只数 N→0→N）。
 * 结束时验「收起导航栏」：按钮与顶栏展开按钮本身要过命中测试（展开按钮还须整颗在顶栏内、
 * 与快速搜索横向不相交、搜索中心仍命中自己）、reload 后仍收起
 * （localStorage.vrc-nav-collapsed=1）、展开回来当前页项仍高亮/仍点得到/再点不换页。
 * 最后验收起态快捷键 Ctrl+1..9：每个数字 hash=PAGE_ORDER[d-1]（读 web/src/lib/shortcuts.js）、
 * 标题跟变、侧栏仍不出现；展开回来当前项已高亮且过命中测试。
 * 收起态另验 `?` 快捷键表（收起后只能靠这张表记数字键）：跳页组必须正好 9 项、标签与按键
 * 顺序跟 PAGE_ORDER/PAGE_LABEL 一致（从源文件解析，不从 DOM 反推）、面板整块在视口内、
 * Esc 关掉后仍是收起态、再按 Ctrl+5 照旧跳页。
 * 收起态还验 Ctrl K 命令面板（收起后找东西只剩这条路）：打开时输入框聚焦/侧栏不回来/整块在
 * 视口内；面板开着时 Ctrl+3 不许跳页（App.jsx 的 `if (palette) return`）；无匹配串结果归 0 且
 * 给空态文案；Esc 关掉仍收起、再 Ctrl K 能再开；粘 wrld_ ID → 置顶「直接打开」→ Enter 真开
 * 世界抽屉（带该 ID），关掉抽屉仍是收起态。
 * 展开态也验 Ctrl K（此时侧栏还在，验的是面板不把导航状态弄丢）：打开时输入框聚焦、侧栏在位、
 * 当前页项仍高亮；输入后 ↓/↑ 真移动选中项（按 index 比对且不越界）；↓+Enter 关面板并开好友
 * 抽屉且名字对得上；关抽屉再 Ctrl K、点遮罩空白处也能关，侧栏与当前页高亮原样。
 * 展开态 Ctrl K 另验「鼠标点结果行」（面板关、好友抽屉名字=那一行 label、hash 不变）与
 * 「Esc 关面板不改 hash」。
 * 展开态再补两条：Ctrl+1..9 逐键验「跳页 + 标题 + 侧栏在位 + 当前项高亮且点得到」，reload 后
 * 仍是展开（localStorage.vrc-nav-collapsed≠1，与收起态那条互为对照）；`?` 快捷键表在侧栏在场时
 * 跳页组同样 9 项/顺序对、Esc 关掉不动侧栏与高亮、关掉后 Ctrl+7 照旧跳页。
 * 断言「能到 + 标题对 + 点得到」；密度/像素交给 frame_parity.mjs。
 * 产出 docs/ref/nav-coverage.json；有 FAIL 则 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normBase, pageBase, assertVrcPage, gotoVrc } from './lib/page_structure.mjs';

const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = normBase(process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8899'));
const PAGE = pageBase(BASE);
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/nav-coverage.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 与 frame_parity 同口径（含 600 高矮窗两档：导航必须靠滚动且每项仍点得到）
const ALL_VIEWS = [[1024, 600], [1024, 768], [1100, 800], [1280, 600], [1280, 800], [1366, 768], [1440, 900], [1600, 900], [1700, 1040]];
const DEFAULT_VIEWS = [[1688, 1028], [1366, 768], [1100, 800], [1024, 768]];
const parseViews = (s) => s.split(',').map((v) => v.trim()).filter(Boolean)
  .map((v) => v.split('x').map(Number)).filter((v) => v.length === 2 && v.every(Number.isFinite));
const VIEWS = process.env.NAV_VIEWS
  ? (process.env.NAV_VIEWS === 'all' ? ALL_VIEWS : parseViews(process.env.NAV_VIEWS))
  : DEFAULT_VIEWS;
// 主题两态：vrc-theme 存在 localStorage，建 context 时注入。
const THEMES = process.env.NAV_THEME ? [process.env.NAV_THEME] : ['light', 'dark'];

// 期望：侧栏页面 id → 标题（App.jsx TITLES 第一列）
const app = fs.readFileSync(path.join(ROOT, 'web/src/App.jsx'), 'utf8');
const titlesBlock = app.slice(app.indexOf('const TITLES = {'), app.indexOf('function useTheme'));
const WANT = Object.fromEntries(
  [...titlesBlock.matchAll(/^\s{2}(\w+):\s*\['([^']*)'/gm)].map((m) => [m[1], m[2]])
);

// Ctrl/⌘+数字 的跳页顺序来自 web/src/lib/shortcuts.js 的 PAGE_ORDER（不是 DOM 顺序：
// 用 DOM 顺序当期望会把「快捷键表和侧栏顺序对不上」这类 bug 一起放过）。
const shortcutsSrc = fs.readFileSync(path.join(ROOT, 'web/src/lib/shortcuts.js'), 'utf8');
const ORDER = (shortcutsSrc.match(/export const PAGE_ORDER = \[([\s\S]*?)\]/)?.[1] ?? '')
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

// `?` 面板跳页组的期望：标签与按键都来自 PAGE_LABEL / PAGE_ORDER（面板内容由 SHORTCUT_GROUPS 生成，
// 这里独立解析源文件，不从 DOM 反推，才能抓住「面板顺序跟快捷键对不上」这类错）。
const labelBlock = shortcutsSrc.slice(
  shortcutsSrc.indexOf('export const PAGE_LABEL = {'),
  shortcutsSrc.indexOf('};', shortcutsSrc.indexOf('export const PAGE_LABEL = {'))
);
const LABEL = Object.fromEntries(
  [...labelBlock.matchAll(/^\s{2}(\w+):\s*'([^']*)'/gm)].map((m) => [m[1], m[2]])
);
const JUMP_WANT = ORDER.slice(0, 9).map((id, i) => ({ id, label: LABEL[id] ?? id, key: `⌘/Ctrl ${i + 1}` }));

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const rows = [];
const perView = [];

for (const theme of THEMES) {
for (const [width, height] of VIEWS) {
  const view = theme === 'dark' ? `${width}x${height}/dark` : `${width}x${height}`;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (theme === 'dark') {
    await ctx.addInitScript(() => { try { localStorage.setItem('vrc-theme', 'dark'); } catch {} });
  }
  const page = await ctx.newPage();
  let viewRows = 0, viewPass = 0;
  const push = (row) => { rows.push(row); viewRows++; if (row.ok) viewPass++; };
  try {
    await gotoVrc(page, PAGE);
    await assertVrcPage(page, `nav@${view}`);
    // 等侧栏渲染出至少一个导航项（demo 种子要一点时间）
    await page.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
    const ids = await page.evaluate(() => [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].map((el) => el.dataset.navId));

    for (const id of ids) {
      const r = await page.evaluate(async (id) => {
        const wait = (ms) => new Promise((res) => setTimeout(res, ms));
        const btn = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].find((el) => el.dataset.navId === id);
        if (!btn) return { hash: '', title: '', err: 'nav item vanished', active: false, vis: false, hit: false };
        const b0 = btn.getBoundingClientRect();
        const vis = b0.width > 1 && b0.height > 1 && getComputedStyle(btn).visibility !== 'hidden';
        let hit = null;
        if (vis) {
          btn.scrollIntoView({ block: 'nearest' });
          await wait(80);
          const c = btn.getBoundingClientRect();
          // 可视区：页脚项（设置/收起导航栏）在 [data-nav-footer] 里，其余在 <nav> 滚动容器里
          const scroller = btn.closest('nav') ?? btn.closest('[data-nav-footer]');
          const nav = scroller.getBoundingClientRect();
          const t = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
          hit = !!t && (t === btn || btn.contains(t) || t.contains(btn))
            && c.top >= nav.top - 1 && c.bottom <= nav.bottom + 1;
        }
        btn.click();
        // 等 hash、标题、懒加载块都到位
        const t0 = Date.now();
        let hash = '', title = '', err = null, active = false;
        while (Date.now() - t0 < 8000) {
          await wait(60);
          hash = location.hash;
          title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
          const errBox = [...document.querySelectorAll('h2,h3')].find((el) => el.textContent.includes('这个页面出错了'));
          err = errBox ? errBox.textContent.trim() : null;
          active = btn.dataset.active === 'true';
          if (hash === `#/${id}` && title && !err) break;
        }
        return { hash, title, err, active, vis, hit };
      }, id);
      const okHash = r.hash === `#/${id}`;
      const okTitle = !WANT[id] || r.title === WANT[id];
      const okHit = r.vis ? r.hit === true : true; // 折叠夹里的子项不可见时不判命中
      push({
        id: `${id}@${view}`, view, theme, nav: id, hash: r.hash, title: r.title, want: WANT[id] ?? null,
        active: r.active, hit: r.vis ? r.hit : 'hidden',
        ok: okHash && okTitle && !r.err && okHit,
        error: r.err || (okHit ? null : 'unreachable（命中测试失败）')
      });
    }
    // 折叠夹行为：收起后子项消失（DOM 里没有、旧坐标处也点不到），再展开回来子项可达且点得通
    // （真机两夹默认展开）。只数 N→0→N 会让「子项还在只是被压扁/透明」这类回归漏过去。
    const fold = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const box = document.querySelector('aside.vrc-sidebar [data-nav-folder]');
      const key = box.dataset.navFolder;
      const head = box.querySelector('[data-nav-kind="folder"]');
      const subEls = [...box.querySelectorAll('[data-nav-kind="sub"]')];
      const before = subEls.length;
      const subId = subEls[0]?.dataset.navId ?? '';
      let spot = null;
      if (subEls[0]) {
        const b = subEls[0].getBoundingClientRect();
        spot = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
      head.click();
      await wait(250);
      const closed = box.querySelectorAll('[data-nav-kind="sub"]').length;
      // 收起后：该子项不在 DOM，旧坐标处命中的元素也不是它（不可点）
      const subGone = !document.querySelector(`aside.vrc-sidebar [data-nav-id="${subId}"]`);
      const oldSpotHitsSub = spot
        ? document.elementsFromPoint(spot.x, spot.y).some((e) => e.dataset?.navId === subId)
        : false;
      head.click();
      await wait(250);
      const reopened = box.querySelectorAll('[data-nav-kind="sub"]').length;
      // 展开回来：子项在、命中测试过、点下去真的换到那一页
      let reach = false, hash = location.hash, title = '';
      const again = document.querySelector(`aside.vrc-sidebar [data-nav-id="${subId}"]`);
      if (again) {
        again.scrollIntoView({ block: 'nearest' });
        await wait(120);
        const b = again.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        reach = !!t && (t === again || again.contains(t) || t.contains(again));
        again.click();
        const t0 = Date.now();
        while (Date.now() - t0 < 8000) {
          await wait(60);
          hash = location.hash;
          title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
          if (hash === `#/${subId}` && title) break;
        }
      }
      return { key, before, closed, reopened, subId, subGone, oldSpotHitsSub, reach, hash, title };
    });
    push({
      id: `folder:${fold.key}@${view}`, view, theme, nav: `folder:${fold.key}`, hash: fold.hash || '-',
      title: `${fold.before}→${fold.closed}→${fold.reopened}`, want: 'N→0→N，收起不可点、展开可点',
      active: `gone=${fold.subGone} reach=${fold.reach}`, hit: '-',
      ok: fold.before > 0 && fold.closed === 0 && fold.reopened === fold.before
        && fold.subGone && !fold.oldSpotHitsSub && fold.reach
        && fold.hash === `#/${fold.subId}` && (!WANT[fold.subId] || fold.title === WANT[fold.subId]),
      error: null
    });
    // SidebarFooter「收起导航栏」：按钮本身要能点到（elementFromPoint 落在按钮内），收起后顶栏
    // 展开按钮同样要能点到；reload 后仍保持收起（localStorage 持久化）；展开回来当前页仍高亮、
    // 仍点得到，再点一次页面不变（收起再展开不该丢位置）。
    const collapse = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const hitOf = (el) => {
        if (!el) return false;
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) return false;
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return !!t && (t === el || el.contains(t) || t.contains(el));
      };
      const btn = document.querySelector('[data-testid="nav-collapse"]');
      const curId = (location.hash.match(/^#\/([\w-]+)/) ?? [])[1] ?? '';
      const curTitle = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
      if (!btn) return { before: true, collapseHit: false, afterClick: true, expandBtn: false, expandHit: false, stored: null, curId, curTitle };
      const before = !!document.querySelector('aside.vrc-sidebar');
      const collapseHit = hitOf(btn);
      btn.click();
      await wait(300);
      const afterClick = !!document.querySelector('aside.vrc-sidebar');
      const ex = document.querySelector('[data-testid="nav-expand"]');
      // 展开按钮几何：整颗落在顶栏内，且与「快速搜索」横向不重叠、搜索按钮中心仍命中自己
      // （防：收起后按钮溢出顶栏 / 压住搜索）。
      const tbEl = document.querySelector('#vrc-topbar');
      const srch = document.querySelector('[data-topbar="search"]');
      let geom = { inTopbar: false, gapSearch: null, searchHit: false };
      if (ex && tbEl && srch) {
        const tbr = tbEl.getBoundingClientRect();
        const er = ex.getBoundingClientRect();
        const sr = srch.getBoundingClientRect();
        geom.inTopbar = er.left >= tbr.left - 1 && er.right <= tbr.right + 1
          && er.top >= tbr.top - 1 && er.bottom <= tbr.bottom + 1;
        geom.gapSearch = Math.round(sr.left - er.right);
        if (sr.width > 1) {
          const st = document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2);
          geom.searchHit = !!st && (st === srch || srch.contains(st) || st.contains(srch));
        }
      }
      return {
        before, collapseHit, afterClick,
        expandBtn: !!ex, expandHit: hitOf(ex), geom,
        stored: localStorage.getItem('vrc-nav-collapsed'), curId, curTitle
      };
    });
    push({
      id: `footer:collapse@${view}`, view, theme, nav: 'footer:collapse', hash: '-',
      title: `${collapse.before ? 'nav' : 'no'}→${collapse.afterClick ? 'nav' : 'no'}`,
      want: 'nav→no，收起/展开按钮均命中', active: `hit=${collapse.collapseHit}/${collapse.expandHit}`, hit: '-',
      ok: collapse.before && !collapse.afterClick && collapse.expandBtn && collapse.collapseHit && collapse.expandHit
        && collapse.stored === '1',
      error: null
    });
    // 展开按钮不能溢出顶栏，也不能压住「快速搜索」（收了侧栏顶上多一个按钮，最容易挤坏这一簇）
    push({
      id: `footer:expand_geom@${view}`, view, theme, nav: 'footer:expand_geom', hash: '-',
      title: collapse.geom ? `in=${collapse.geom.inTopbar} gap=${collapse.geom.gapSearch}` : 'no geom',
      want: '按钮在顶栏内，与搜索不相交，搜索中心仍命中', active: `searchHit=${collapse.geom?.searchHit}`,
      hit: '-',
      ok: !!collapse.geom && collapse.geom.inTopbar && collapse.geom.gapSearch > 0 && collapse.geom.searchHit === true,
      error: null
    });
    // 收起态写在 localStorage，reload 必须还是收起（刷新后不弹回展开）
    await page.reload();
    await page.waitForFunction(() => !!document.querySelector('#vrc-topbar h1')?.textContent?.trim(), { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const persist = await page.evaluate(() => ({
      asideGone: !document.querySelector('aside.vrc-sidebar'),
      expand: !!document.querySelector('[data-testid="nav-expand"]'),
      stored: localStorage.getItem('vrc-nav-collapsed'),
      hash: location.hash
    }));
    push({
      id: `footer:persist@${view}`, view, theme, nav: 'footer:persist', hash: persist.hash,
      title: `after reload: ${persist.asideGone ? 'collapsed' : 'expanded'}`, want: 'collapsed',
      active: `stored=${persist.stored}`, hit: '-',
      ok: persist.asideGone && persist.expand && persist.stored === '1'
        && (!collapse.curId || persist.hash === `#/${collapse.curId}`),
      error: null
    });
    // 展开回来：当前页那一项仍在、仍高亮、仍命中，再点不换页
    const back = await page.evaluate(async (curId) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = { found: false, active: false, hit: false, hash: location.hash, title: '' };
      const ex = document.querySelector('[data-testid="nav-expand"]');
      if (!ex) return out;
      const eb = ex.getBoundingClientRect();
      const et = document.elementFromPoint(eb.x + eb.width / 2, eb.y + eb.height / 2);
      out.expandHit = !!et && (et === ex || ex.contains(et) || et.contains(ex));
      ex.click();
      await wait(350);
      const item = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].find((el) => el.dataset.navId === curId);
      if (item) {
        out.found = true;
        item.scrollIntoView({ block: 'nearest' });
        await wait(120);
        const b = item.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        out.active = item.dataset.active === 'true';
        out.hit = !!t && (t === item || item.contains(t) || t.contains(item));
        item.click();
        await wait(400);
        out.hash = location.hash;
        out.title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
      }
      return out;
    }, collapse.curId);
    push({
      id: `footer:restore@${view}`, view, theme, nav: `restore:${collapse.curId}`, hash: back.hash,
      title: back.title, want: collapse.curTitle, active: back.active, hit: back.hit,
      ok: !!collapse.curId && back.expandHit === true && back.found && back.active && back.hit
        && back.hash === `#/${collapse.curId}` && back.title === collapse.curTitle,
      error: null
    });
    // 收起态快捷键：Ctrl+1..9 是「不点侧栏也能跳页」的主路径，收起后必须照样生效——
    // 每按一个数字：hash=#/<PAGE_ORDER[d-1]>、顶栏标题跟变、侧栏仍不出现、展开按钮还在；
    // 最后展开回来：当前页那一项必须已高亮、且过命中测试（快捷键跳过的页也要认）。
    const N = Math.min(9, ORDER.length);
    await page.click('[data-testid="nav-collapse"]');
    await page.waitForTimeout(300);
    const presses = [];
    for (let d = 1; d <= N; d++) {
      const want = ORDER[d - 1];
      await page.keyboard.press(`Control+${d}`);
      await page.waitForTimeout(260);
      const st = await page.evaluate(() => ({
        hash: location.hash,
        title: document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '',
        asideGone: !document.querySelector('aside.vrc-sidebar'),
        expand: !!document.querySelector('[data-testid="nav-expand"]')
      }));
      presses.push({ d, want, ...st, ok: st.hash === `#/${want}` && st.title === (WANT[want] ?? '') && st.asideGone && st.expand });
    }
    const badPress = presses.filter((p) => !p.ok);
    push({
      id: `shortcut:collapsed@${view}`, view, theme, nav: 'shortcut:collapsed',
      hash: presses[presses.length - 1]?.hash ?? '-', title: `${presses.length - badPress.length}/${N}`,
      want: 'Ctrl+1..9 全部跳到 PAGE_ORDER[d-1]，标题对，侧栏仍收起', active: badPress.map((p) => `Ctrl${p.d}→${p.hash}`).join(',') || 'all ok',
      hit: '-', ok: presses.length === N && badPress.length === 0,
      error: badPress.length ? `快捷键失配：${badPress.map((p) => `Ctrl${p.d} 期望#/${p.want} 实得${p.hash}/${p.title}`).join('；')}` : null
    });
    // 收起态浮层：`?`（Shift+/）打开快捷键表 —— 收起侧栏后「记不住数字键」只能靠这张表，
    // 所以跳页组必须正好 9 项、标签与按键顺序都跟着 PAGE_ORDER 走；Esc 关掉后仍处于收起态
    // （浮层不该把侧栏带回来），关掉后数字键照旧生效。
    // 注意：headless shell 对 Shift+/ 报 e.key='/'（真实浏览器是 '?'），所以这里直接发 '?'，
    // 断言的仍是「用户按 Shift+/ 能开表」这条路径（App 判 e.key==='?'）。
    await page.keyboard.press('?');
    await page.waitForTimeout(300);
    const helpOpen = await page.evaluate(() => {
      const panel = document.querySelector('.shortcut-panel');
      const grp = panel?.querySelector('[data-shortcut-group="跳页"]');
      const items = grp ? [...grp.children].slice(1).map((row) => ({
        label: row.querySelector('span')?.textContent?.trim() ?? '',
        key: row.querySelector('kbd')?.textContent?.trim() ?? ''
      })) : [];
      return {
        panel: !!panel,
        asideGone: !document.querySelector('aside.vrc-sidebar'),
        count: items.length,
        items,
        // 浮层得真的画在视口里（收起后浮层居中/尺寸算错会飘到屏外）
        inView: panel ? (() => { const b = panel.getBoundingClientRect(); return b.width > 100 && b.height > 100 && b.top >= 0 && b.left >= 0 && b.bottom <= window.innerHeight + 1; })() : false
      };
    });
    const wantJump = JUMP_WANT;
    const jumpOk = helpOpen.count === wantJump.length
      && helpOpen.items.every((it, i) => it.label === wantJump[i].label && it.key === wantJump[i].key);
    push({
      id: `help:collapsed_jump@${view}`, view, theme, nav: 'help:collapsed_jump', hash: '-',
      title: `${helpOpen.count} 项`, want: `${wantJump.length} 项：${wantJump.map((w) => w.label).join('/')}`,
      active: helpOpen.items.map((it) => it.label).join('/'), hit: `inView=${helpOpen.inView}`,
      ok: helpOpen.panel && jumpOk && helpOpen.asideGone && helpOpen.inView,
      error: jumpOk ? null : `跳页组失配：${helpOpen.items.map((it) => `${it.label}(${it.key})`).join('，')}`
    });
    // Esc 关闭 → 浮层消失、仍是收起态；关掉后 Ctrl+5 照旧跳到 PAGE_ORDER[4]
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const lvl5 = ORDER[4];
    const afterEsc = await page.evaluate(() => ({
      panel: !!document.querySelector('.shortcut-panel'),
      asideGone: !document.querySelector('aside.vrc-sidebar'),
      expand: !!document.querySelector('[data-testid="nav-expand"]')
    }));
    await page.keyboard.press('Control+5');
    await page.waitForTimeout(300);
    const afterKey = await page.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '',
      asideGone: !document.querySelector('aside.vrc-sidebar')
    }));
    push({
      id: `help:collapsed_esc@${view}`, view, theme, nav: 'help:collapsed_esc', hash: afterKey.hash,
      title: `${afterEsc.panel ? 'still open' : 'closed'} → ${afterKey.title}`, want: `${WANT[lvl5] ?? ''}`,
      active: `expand=${afterEsc.expand} asideGone=${afterKey.asideGone}`, hit: '-',
      ok: !afterEsc.panel && afterEsc.asideGone && afterEsc.expand
        && afterKey.hash === `#/${lvl5}` && afterKey.title === (WANT[lvl5] ?? '') && afterKey.asideGone,
      error: null
    });
    // 收起态命令面板（Ctrl K）：收起侧栏后顶栏搜索框是唯一的找东西入口，所以面板必须
    // ① 打开时侧栏不冒出来、输入框已聚焦、整块在视口内；② 面板开着时 Ctrl+1..9 不许偷偷跳页
    // （App.jsx 里有 `if (palette) return`，这条回归最容易在改快捷键时挂）；③ Esc 关掉仍是收起态；
    // ④ 再 Ctrl K 能再开；⑤ 粘贴 wrld_ ID → 置顶「直接打开」→ Enter 真开世界抽屉（验 Enter 路径，
    //    不只是「面板能开个壳」）。
    const WRLD = 'wrld_00000000-0000-4000-8000-000000000001';
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(350);
    const palOpen = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="palette"]');
      const input = panel?.querySelector('input');
      const b = panel?.getBoundingClientRect();
      return {
        open: !!panel,
        focused: !!input && document.activeElement === input,
        asideGone: !document.querySelector('aside.vrc-sidebar'),
        expand: !!document.querySelector('[data-testid="nav-expand"]'),
        inView: !!b && b.width > 200 && b.height > 60 && b.top >= -1 && b.left >= -1
          && b.bottom <= window.innerHeight + 1 && b.right <= window.innerWidth + 1,
        hash: location.hash
      };
    });
    const guardBefore = palOpen.hash;
    await page.keyboard.press('Control+3');
    await page.waitForTimeout(260);
    const guarded = await page.evaluate(() => ({
      hash: location.hash,
      panel: !!document.querySelector('[data-testid="palette"]')
    }));
    push({
      id: `palette:open@${view}`, view, theme, nav: 'palette:open', hash: palOpen.hash,
      title: `open=${palOpen.open} focus=${palOpen.focused}`, want: '面板打开、输入框聚焦、侧栏仍收起、整块在视口内',
      active: `asideGone=${palOpen.asideGone} expand=${palOpen.expand} inView=${palOpen.inView}`, hit: '-',
      ok: palOpen.open && palOpen.focused && palOpen.asideGone && palOpen.expand && palOpen.inView,
      error: null
    });
    push({
      id: `palette:guard@${view}`, view, theme, nav: 'palette:guard', hash: guarded.hash,
      title: `${guardBefore} → ${guarded.hash}`, want: `面板开着时 Ctrl+3 不改 hash（${guardBefore}）`,
      active: `panel=${guarded.panel}`, hit: '-',
      ok: guarded.panel && guarded.hash === guardBefore,
      error: guarded.hash === guardBefore ? null : `面板开着按 Ctrl+3 竟然跳页：${guarded.hash}`
    });
    // 输入过滤：没有任何匹配时结果必须归 0 并给出空态文案（不能停在上一次的结果里）
    await page.keyboard.type('zzzqqqxxyvrc');
    await page.waitForTimeout(900);
    const filtered = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="palette"]');
      const list = panel?.querySelector('.cmdk-list');
      const foot = panel?.textContent ?? '';
      return {
        items: list ? [...list.querySelectorAll('button')].length : -1,
        empty: /没找到匹配|搜索中/.test(list?.textContent ?? ''),
        zero: /0\s*条结果/.test(foot),
        q: panel?.querySelector('input')?.value ?? ''
      };
    });
    push({
      id: `palette:filter@${view}`, view, theme, nav: 'palette:filter', hash: guarded.hash,
      title: `q=${filtered.q} → ${filtered.items} 条`, want: '0 条且空态文案 + 页脚 0 条结果',
      active: `empty=${filtered.empty} zero=${filtered.zero}`, hit: '-',
      ok: filtered.items === 0 && filtered.empty && filtered.zero,
      error: null
    });
    // Esc 关掉：面板消失、仍是收起态、页面没被带走；再 Ctrl K 能再开
    await page.keyboard.press('Escape');
    await page.waitForTimeout(280);
    const esc1 = await page.evaluate(() => ({
      panel: !!document.querySelector('[data-testid="palette"]'),
      asideGone: !document.querySelector('aside.vrc-sidebar'),
      expand: !!document.querySelector('[data-testid="nav-expand"]'),
      hash: location.hash
    }));
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(320);
    const reopened = await page.evaluate(() => ({
      panel: !!document.querySelector('[data-testid="palette"]'),
      q: document.querySelector('[data-testid="palette"] input')?.value ?? null,
      asideGone: !document.querySelector('aside.vrc-sidebar')
    }));
    push({
      id: `palette:esc_reopen@${view}`, view, theme, nav: 'palette:esc_reopen', hash: esc1.hash,
      title: `${esc1.panel ? 'still open' : 'closed'} → ${reopened.panel ? 'reopen' : 'no reopen'}`,
      want: 'Esc 关闭且仍收起、hash 不变，再 Ctrl K 能再开（输入清空）',
      active: `asideGone=${esc1.asideGone}/${reopened.asideGone} expand=${esc1.expand} q=${reopened.q}`, hit: '-',
      ok: !esc1.panel && esc1.asideGone && esc1.expand && esc1.hash === guardBefore
        && reopened.panel && reopened.asideGone && (reopened.q === '' || reopened.q === null),
      error: null
    });
    // 粘 wrld_ ID：置顶「直接打开」→ Enter 必须真开世界抽屉（Palette→Drawer 这条链路）
    await page.keyboard.press('Control+a');
    await page.keyboard.type(WRLD);
    await page.waitForTimeout(320);
    const directRow = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="palette"]');
      const list = panel?.querySelector('.cmdk-list');
      const btns = list ? [...list.querySelectorAll('button')] : [];
      return {
        items: btns.length,
        first: btns[0]?.textContent?.trim() ?? '',
        group: (list?.textContent ?? '').includes('直接打开'),
        q: panel?.querySelector('input')?.value ?? ''
      };
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const drawer = await page.evaluate((id) => {
      const el = document.querySelector('[data-testid="world-drawer"]');
      return {
        palette: !!document.querySelector('[data-testid="palette"]'),
        drawer: !!el,
        hasId: !!el && (el.textContent ?? '').includes(id),
        asideGone: !document.querySelector('aside.vrc-sidebar'),
        expand: !!document.querySelector('[data-testid="nav-expand"]'),
        hash: location.hash
      };
    }, WRLD);
    push({
      id: `palette:direct@${view}`, view, theme, nav: 'palette:direct', hash: drawer.hash,
      title: `${directRow.items} 条「${directRow.first.slice(0, 14)}」→ drawer=${drawer.drawer}`,
      want: '1 条直接打开 → Enter 关面板开世界抽屉（带该 ID）',
      active: `group=${directRow.group} hasId=${drawer.hasId} asideGone=${drawer.asideGone} expand=${drawer.expand}`, hit: '-',
      ok: directRow.items === 1 && directRow.group && directRow.q === WRLD
        && !drawer.palette && drawer.drawer && drawer.hasId && drawer.asideGone && drawer.expand
        && drawer.hash === guardBefore,
      error: null
    });
    // 关掉抽屉，回到收起态（下面还要用 Ctrl+N 那条路径）
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="world-drawer"]');
      const btn = [...(el?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '关闭');
      btn?.click();
    });
    await page.waitForTimeout(300);
    const drawerClosed = await page.evaluate(() => ({
      drawer: !!document.querySelector('[data-testid="world-drawer"]'),
      asideGone: !document.querySelector('aside.vrc-sidebar')
    }));
    push({
      id: `palette:drawer_close@${view}`, view, theme, nav: 'palette:drawer_close', hash: guardBefore,
      title: drawerClosed.drawer ? 'still open' : 'closed', want: '抽屉关掉且仍是收起态',
      active: `asideGone=${drawerClosed.asideGone}`, hit: '-',
      ok: !drawerClosed.drawer && drawerClosed.asideGone,
      error: null
    });
    // 快捷键落到 Ctrl+N 那页（shortcut:expand 用它验「快捷键跳过的页展开后仍高亮、仍点得到」）
    await page.keyboard.press(`Control+${N}`);
    await page.waitForTimeout(300);
    const lastWant = ORDER[N - 1];
    const sk = await page.evaluate(async (want) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = { found: false, active: false, hit: false, hash: location.hash, title: '' };
      const ex = document.querySelector('[data-testid="nav-expand"]');
      if (!ex) return out;
      ex.click();
      await wait(350);
      const item = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].find((el) => el.dataset.navId === want);
      if (item) {
        out.found = true;
        item.scrollIntoView({ block: 'nearest' });
        await wait(120);
        const b = item.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        out.active = item.dataset.active === 'true';
        out.hit = !!t && (t === item || item.contains(t) || t.contains(item));
      }
      out.hash = location.hash;
      out.title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
      return out;
    }, lastWant);
    push({
      id: `shortcut:expand@${view}`, view, theme, nav: `shortcut:expand:${lastWant}`, hash: sk.hash,
      title: sk.title, want: WANT[lastWant] ?? null, active: sk.active, hit: sk.hit,
      ok: sk.found && sk.active && sk.hit && sk.hash === `#/${lastWant}` && sk.title === (WANT[lastWant] ?? ''),
      error: null
    });
    // 展开态命令面板（Ctrl K）：收起态验的是「找东西只有这条路」，展开态要验的是
    // ① 打开时侧栏在位、输入框聚焦、当前页导航项仍高亮且过命中测试（面板不该把导航状态弄丢）；
    // ② 输入后 ↓/↑ 真的移动选中项（拿到列表后按 index 比对，不靠肉眼），且不会越界；
    // ③ ↓ 到第 2 条后 Enter：面板关掉、好友详情抽屉打开，抽屉里的名字与面板那条对得上；
    // ④ 关掉抽屉再 Ctrl K，点遮罩空白处（面板外）也要能关掉，侧栏与当前页高亮原样。
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(400);
    const palExp = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const activeNav = () => {
        const item = document.querySelector('aside.vrc-sidebar [data-nav-id][data-active="true"]');
        if (!item) return { id: null, hit: false };
        const b = item.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { id: item.dataset.navId, hit: !!t && (t === item || item.contains(t) || t.contains(item)) };
      };
      await wait(50);
      const panel = document.querySelector('[data-testid="palette"]');
      const input = panel?.querySelector('input');
      const b = panel?.getBoundingClientRect();
      return {
        open: !!panel,
        focused: !!input && document.activeElement === input,
        aside: !!document.querySelector('aside.vrc-sidebar'),
        inView: !!b && b.width > 200 && b.top >= -1 && b.bottom <= window.innerHeight + 1,
        nav: activeNav()
      };
    });
    push({
      id: `palette:expanded_open@${view}`, view, theme, nav: 'palette:expanded_open', hash: '-',
      // 面板是 fixed inset-0 的遮罩，开着的时候导航项本来就点不到（命中测试交给关掉之后的遮罩那条），
      // 这里只要求「高亮还在」（data-active 没被面板打开弄丢）。
      title: `open=${palExp.open} focus=${palExp.focused}`, want: '面板打开且聚焦，侧栏在位，当前页项仍高亮',
      active: `aside=${palExp.aside} nav=${palExp.nav.id}`, hit: '-',
      ok: palExp.open && palExp.focused && palExp.aside && palExp.inView && !!palExp.nav.id,
      error: palExp.open ? null : 'Ctrl K 在展开态打不开面板'
    });
    // 输入 'a' 过滤出多条 → 记下选中 index，↓ 后 +1，↑ 回原位
    await page.keyboard.type('a');
    await page.waitForTimeout(900);
    const sel = () => page.evaluate(() => {
      const btns = [...(document.querySelector('.cmdk-list')?.querySelectorAll('button') ?? [])];
      const idx = btns.findIndex((el) => (el.getAttribute('style') ?? '').includes('selected-surface'));
      return {
        n: btns.length,
        idx,
        labels: btns.map((el) => el.querySelector('span')?.textContent?.trim() ?? '')
      };
    });
    const s0 = await sel();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(180);
    const s1 = await sel();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(180);
    const s2 = await sel();
    const downWant = Math.min(s0.idx + 1, Math.max(s0.n - 1, 0));
    push({
      id: `palette:expanded_arrows@${view}`, view, theme, nav: 'palette:expanded_arrows', hash: '-',
      title: `${s0.n} 条 sel ${s0.idx}→${s1.idx}→${s2.idx}`,
      want: `${s0.n}≥2 条，↓ 到 ${downWant}，↑ 回 ${s0.idx}`,
      active: s0.labels.slice(0, 3).join('/'), hit: '-',
      ok: s0.n >= 2 && s0.idx === 0 && s1.idx === downWant && s2.idx === s0.idx,
      error: s0.n < 2 ? `搜索 'a' 只出 ${s0.n} 条，箭头行走无法验证` : `选中位移不符：${s0.idx}→${s1.idx}→${s2.idx}`
    });
    // ↓ 到第 2 条 → Enter：面板关、好友抽屉开、名字对得上
    const wantName = s0.labels[downWant] ?? '';
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(180);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const fd = await page.evaluate(() => {
      const card = document.querySelector('.fd-card');
      return {
        palette: !!document.querySelector('[data-testid="palette"]'),
        card: !!card,
        name: card?.querySelector('.fd-namepill strong')?.textContent?.trim() ?? '',
        idTitle: card?.querySelector('.fd-kv b')?.getAttribute('title') ?? '',
        aside: !!document.querySelector('aside.vrc-sidebar')
      };
    });
    push({
      id: `palette:expanded_enter@${view}`, view, theme, nav: 'palette:expanded_enter', hash: '-',
      title: `「${fd.name}」 id=${fd.idTitle.slice(0, 10)}`, want: `抽屉名字 =「${wantName}」、面板已关、侧栏在位`,
      active: `palette=${fd.palette} aside=${fd.aside}`, hit: '-',
      ok: !fd.palette && fd.card && fd.aside && (fd.name === wantName || (!!wantName && fd.name.includes(wantName))),
      error: fd.card ? `名字不符：抽屉「${fd.name}」/ 期望「${wantName}」` : 'Enter 后没打开好友抽屉'
    });
    // 关抽屉 → Ctrl K → 点面板外的遮罩 → 必须关掉，侧栏与当前页高亮不变
    await page.click('.fd-close');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(350);
    const beforeMask = await page.evaluate(() => !!document.querySelector('[data-testid="palette"]'));
    await page.mouse.click(6, 6);
    await page.waitForTimeout(350);
    const afterMask = await page.evaluate(() => {
      const item = document.querySelector('aside.vrc-sidebar [data-nav-id][data-active="true"]');
      let hit = false;
      if (item) {
        const b = item.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        hit = !!t && (t === item || item.contains(t) || t.contains(item));
      }
      return {
        palette: !!document.querySelector('[data-testid="palette"]'),
        aside: !!document.querySelector('aside.vrc-sidebar'),
        nav: item?.dataset.navId ?? null,
        hit
      };
    });
    push({
      id: `palette:expanded_mask@${view}`, view, theme, nav: 'palette:expanded_mask', hash: '-',
      title: `open=${beforeMask} → ${afterMask.palette ? 'still open' : 'closed'}`,
      want: '点遮罩关面板，侧栏在位、当前页项仍高亮且点得到',
      active: `aside=${afterMask.aside} nav=${afterMask.nav}`, hit: afterMask.hit,
      ok: beforeMask && !afterMask.palette && afterMask.aside && !!afterMask.nav && afterMask.hit,
      error: !beforeMask ? 'Ctrl K 没能再开面板' : '点遮罩没关掉面板'
    });
    // ⑤ 点结果行（此前只验了箭头+Enter，鼠标点行是另一半入口）：Ctrl K → 输入 'a' →
    //    用鼠标点「好友」组第一行的中心 → 面板关、好友抽屉开、抽屉名字=那一行 label、
    //    侧栏仍在、hash 不变（好友抽屉是浮层，不改路由）。
    // ⑥ Esc 关面板不改 hash：开着面板输入一串没有匹配的词，Esc 关掉后 hash 必须与打开前一致
    //    （面板是搜索浮层，不是导航，任何一条路径都不该把当前页带走）。
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(350);
    await page.keyboard.type('a');
    await page.waitForTimeout(1000);
    const hashBeforePick = await page.evaluate(() => location.hash);
    const pickRows = await page.evaluate(() => {
      const list = document.querySelector('.cmdk-list');
      if (!list) return [];
      let g = '';
      const out = [];
      for (const n of list.querySelectorAll('div.label-xs, button')) {
        if (n.tagName !== 'BUTTON') { g = n.textContent.trim(); continue; }
        const b = n.getBoundingClientRect();
        out.push({
          group: g,
          label: n.querySelector('span')?.textContent?.trim() ?? '',
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          h: Math.round(b.height)
        });
      }
      return out;
    });
    const pick = pickRows.find((r) => r.group === '好友' && r.h > 0) ?? null;
    if (pick) {
      await page.mouse.click(pick.x, pick.y);
      await page.waitForTimeout(800);
    }
    const pickAfter = await page.evaluate(() => {
      const card = document.querySelector('.fd-card');
      return {
        palette: !!document.querySelector('[data-testid="palette"]'),
        card: !!card,
        name: card?.querySelector('.fd-namepill strong')?.textContent?.trim() ?? '',
        aside: !!document.querySelector('aside.vrc-sidebar'),
        hash: location.hash
      };
    });
    push({
      id: `palette:expanded_click@${view}`, view, theme, nav: 'palette:expanded_click', hash: pickAfter.hash,
      title: `点「${pick?.label ?? '-'}」→ 抽屉「${pickAfter.name}」`,
      want: '点结果行关面板并打开抽屉（名字对得上），侧栏在位，hash 不变',
      active: `palette=${pickAfter.palette} aside=${pickAfter.aside}`, hit: '-',
      ok: !!pick && !pickAfter.palette && pickAfter.card && pickAfter.aside
        && (pickAfter.name === pick.label || (!!pick.label && pickAfter.name.includes(pick.label)))
        && pickAfter.hash === hashBeforePick,
      error: !pick ? '搜索 "a" 没有出现「好友」组结果行' : (!pickAfter.card ? '点结果行后没开抽屉' : null)
    });
    // ⑥ Esc 不改 hash
    if (pickAfter.card) await page.click('.fd-close');
    await page.waitForTimeout(300);
    const hashBeforeEsc = await page.evaluate(() => location.hash);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(350);
    await page.keyboard.type('zzzz_no_hit');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    const escHash = await page.evaluate(() => ({
      palette: !!document.querySelector('[data-testid="palette"]'),
      hash: location.hash,
      aside: !!document.querySelector('aside.vrc-sidebar')
    }));
    push({
      id: `palette:expanded_esc_hash@${view}`, view, theme, nav: 'palette:expanded_esc_hash', hash: escHash.hash,
      title: `${hashBeforeEsc} → ${escHash.hash}`, want: `面板关掉且 hash 不变（${hashBeforeEsc}）`,
      active: `palette=${escHash.palette} aside=${escHash.aside}`, hit: '-',
      ok: !escHash.palette && escHash.hash === hashBeforeEsc && escHash.aside,
      error: escHash.hash !== hashBeforeEsc ? `Esc 关面板把页面带走了：${hashBeforeEsc}→${escHash.hash}` : null
    });
    // 展开态快捷键 Ctrl+1..9：收起态验的是「不点侧栏也能跳页」，展开态要验的是快捷键跳完之后
    // 侧栏仍然在位、当前页那一项真的高亮（data-active 跟着 hash 走）、且仍点得到 —— 侧栏在场时
    // 「高亮没跟着快捷键走」最容易发生。每按一个数字独立断言，不只看最后一页。
    const expPresses = [];
    for (let d = 1; d <= N; d++) {
      const want = ORDER[d - 1];
      await page.keyboard.press(`Control+${d}`);
      await page.waitForTimeout(280);
      const st = await page.evaluate(async (wantId) => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const aside = !!document.querySelector('aside.vrc-sidebar');
        const item = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')]
          .find((el) => el.dataset.navId === wantId);
        let active = false, hit = false;
        if (item) {
          item.scrollIntoView({ block: 'nearest' });
          await wait(90);
          const b = item.getBoundingClientRect();
          const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          active = item.dataset.active === 'true';
          hit = !!t && (t === item || item.contains(t) || t.contains(item));
        }
        return {
          hash: location.hash,
          title: document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '',
          aside, expand: !!document.querySelector('[data-testid=\"nav-expand\"]'),
          found: !!item, active, hit
        };
      }, want);
      expPresses.push({
        d, want, ...st,
        ok: st.hash === `#/${want}` && st.title === (WANT[want] ?? '') && st.aside && !st.expand
          && st.found && st.active && st.hit
      });
    }
    const expBad = expPresses.filter((p) => !p.ok);
    push({
      id: `shortcut:expanded@${view}`, view, theme, nav: 'shortcut:expanded',
      hash: expPresses[expPresses.length - 1]?.hash ?? '-', title: `${expPresses.length - expBad.length}/${N}`,
      want: 'Ctrl+1..9 跳到 PAGE_ORDER[d-1]、标题对、侧栏始终在位、当前项高亮且点得到',
      active: expBad.map((p) => `Ctrl${p.d}→${p.hash}/${p.title} act=${p.active} hit=${p.hit}`).join('；') || 'all ok',
      hit: '-', ok: expPresses.length === N && expBad.length === 0,
      error: expBad.length ? `展开态快捷键失配：${expBad.map((p) => `Ctrl${p.d} 期望#/${p.want}`).join('；')}` : null
    });
    // 展开态不该被持久化成收起：reload 后侧栏仍在、没有顶栏展开按钮、localStorage.vrc-nav-collapsed ≠ '1'
    // （与收起态 reload 那条互为对照，防「收起一次以后永远起不来」）。
    await page.reload();
    await page.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const expPersist = await page.evaluate(() => ({
      aside: !!document.querySelector('aside.vrc-sidebar'),
      expand: !!document.querySelector('[data-testid=\"nav-expand\"]'),
      stored: localStorage.getItem('vrc-nav-collapsed'),
      hash: location.hash
    }));
    const lastPage = ORDER[N - 1];
    push({
      id: `shortcut:expanded_persist@${view}`, view, theme, nav: 'shortcut:expanded_persist', hash: expPersist.hash,
      title: `after reload: ${expPersist.aside ? 'expanded' : 'collapsed'}`, want: `expanded，留在 #/${lastPage}`,
      active: `stored=${expPersist.stored} expand=${expPersist.expand}`, hit: '-',
      ok: expPersist.aside && !expPersist.expand && expPersist.stored !== '1'
        && expPersist.hash === `#/${lastPage}`,
      error: null
    });
    // 展开态 `?` 快捷键表：侧栏在场时这张表还得对得上（跳页组 9 项、标签/按键顺序按 PAGE_ORDER /
    // PAGE_LABEL 走、整块在视口内），Esc 关掉不许动侧栏与当前页高亮，关掉后 Ctrl+7 照旧跳页。
    await page.keyboard.press('?');
    await page.waitForTimeout(320);
    const helpExp = await page.evaluate(() => {
      const panel = document.querySelector('.shortcut-panel');
      const grp = panel?.querySelector('[data-shortcut-group=\"跳页\"]');
      const items = grp ? [...grp.children].slice(1).map((row) => ({
        label: row.querySelector('span')?.textContent?.trim() ?? '',
        key: row.querySelector('kbd')?.textContent?.trim() ?? ''
      })) : [];
      const act = document.querySelector('aside.vrc-sidebar [data-nav-id][data-active=\"true\"]');
      const b = panel?.getBoundingClientRect();
      return {
        panel: !!panel, count: items.length, items,
        aside: !!document.querySelector('aside.vrc-sidebar'),
        nav: act?.dataset.navId ?? null,
        inView: !!b && b.width > 100 && b.height > 100 && b.top >= -1 && b.left >= -1
          && b.bottom <= window.innerHeight + 1 && b.right <= window.innerWidth + 1
      };
    });
    const helpExpOk = helpExp.count === JUMP_WANT.length
      && helpExp.items.every((it, i) => it.label === JUMP_WANT[i].label && it.key === JUMP_WANT[i].key);
    push({
      id: `help:expanded_jump@${view}`, view, theme, nav: 'help:expanded_jump', hash: '-',
      title: `${helpExp.count} 项 nav=${helpExp.nav}`, want: `${JUMP_WANT.length} 项且顺序=PAGE_ORDER/PAGE_LABEL，侧栏在位、当前页高亮`,
      active: helpExp.items.map((it) => it.label).join('/'), hit: `inView=${helpExp.inView}`,
      ok: helpExp.panel && helpExpOk && helpExp.aside && helpExp.nav === lastPage && helpExp.inView,
      error: helpExpOk ? null : `跳页组失配：${helpExp.items.map((it) => `${it.label}(${it.key})`).join('，')}`
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(280);
    const escExp = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const item = document.querySelector('aside.vrc-sidebar [data-nav-id][data-active=\"true\"]');
      let hit = false;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
        await wait(90);
        const b = item.getBoundingClientRect();
        const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        hit = !!t && (t === item || item.contains(t) || t.contains(item));
      }
      return {
        panel: !!document.querySelector('.shortcut-panel'),
        aside: !!document.querySelector('aside.vrc-sidebar'),
        expand: !!document.querySelector('[data-testid=\"nav-expand\"]'),
        nav: item?.dataset.navId ?? null, hit, hash: location.hash
      };
    });
    await page.keyboard.press('Control+7');
    await page.waitForTimeout(320);
    const after7 = await page.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '',
      aside: !!document.querySelector('aside.vrc-sidebar'),
      active: document.querySelector('aside.vrc-sidebar [data-nav-id][data-active=\"true\"]')?.dataset.navId ?? null
    }));
    const p7 = ORDER[6];
    push({
      id: `help:expanded_esc@${view}`, view, theme, nav: 'help:expanded_esc', hash: after7.hash,
      title: `${escExp.panel ? 'still open' : 'closed'} → ${after7.title}`, want: `Esc 后侧栏/高亮原样（${lastPage}），Ctrl+7 → ${p7}（${WANT[p7] ?? ''}）`,
      active: `esc.nav=${escExp.nav} hit=${escExp.hit} aside=${escExp.aside}/${after7.aside} active=${after7.active}`, hit: '-',
      ok: !escExp.panel && escExp.aside && !escExp.expand && escExp.nav === lastPage && escExp.hit
        && after7.hash === `#/${p7}` && after7.title === (WANT[p7] ?? '')
        && after7.aside && after7.active === p7,
      error: null
    });
  } finally {
    perView.push({ view, theme, pass: viewPass, total: viewRows });
    await ctx.close();
  }
}
}

await browser.close();

const pass = rows.filter((r) => r.ok).length;
const report = {
  _note: 'nav_coverage.mjs：逐视口逐个点侧栏项，断言 hash=#/<id>、顶栏标题=TITLES[id][0]、无错误边界，可见项还要过命中测试（elementFromPoint 落在自身且整行在 nav 可视区）；最后验折叠夹收起/展开与收起导航栏',
  base: BASE,
  views: VIEWS.map(([w, h]) => `${w}x${h}`),
  themes: THEMES,
  per_view: perView,
  score: Number(((pass / rows.length) * 100).toFixed(1)),
  rows
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('nav@view', 26)}${pad('hash', 22)}${pad('title', 16)}hit    ok`);
for (const r of rows) console.log(`${pad(r.id, 26)}${pad(r.hash, 22)}${pad(r.title, 16)}${pad(String(r.hit), 7)}${r.ok ? 'PASS' : `FAIL${r.error ? ' ' + r.error : ''}`}`);
for (const v of perView) console.log(`${pad(v.view, 12)}${v.pass}/${v.total}`);
console.log(`\n导航可达 ${pass}/${rows.length} (${report.score}%) → ${path.relative(ROOT, OUT)}`);
process.exit(pass === rows.length ? 0 : 1);
