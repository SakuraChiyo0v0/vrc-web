/**
 * 移动端断点回归：把「移动端长什么样」变成可量的数字，而不是看图说话。
 *
 *   node scripts/mobile_parity.mjs [baseUrl] [--all]
 *
 * 覆盖 STRUCT_PAGES + friends（14 页）× 9 个移动视口（360/375/390/414/430 竖屏 + 844×390/932×430 横屏 + 768×1024/820×1180 平板竖屏），
 * 外加 1023 / 1024 与 900×500 / 900×501 两对「断点两侧」检查（窄≤1023/矮≤500 → 移动形态，否则桌面形态）。
 *
 * 每页断言：
 *   1) 无横向溢出：documentElement.scrollWidth ≤ innerWidth+1，且列出右溢元素
 *   2) 表格卡片化（≤1023 或矮≤500）：thead display:none、tbody tr display:flex/flex-direction:column
 *      ≥768：thead 可见、tbody tr 不是 flex 卡片
 *   3) 触控目标：所有可见 button/a/[role=button] 高度 ≥ 32（报告最小值与违规清单；390 竖屏另列 <44 的控件）
 *   4) 字号：可见文本最小字号 ≥ 11（低于 11 视为移动端可读性破线）
 *   5) 抽屉：默认侧栏移出视口；点 ☰ 后 data-open=true 且左边缘 ≥ -1；点 ✕ 关闭
 *   6) 内容区不被压成 0 宽
 *
 * 任一 FAIL 退出码 1；全部 PASS 打印 MOBILE OK。
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { STRUCT_PAGES, assertVrcServer } from './lib/page_structure.mjs';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8891');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const PAGES = ['friends', ...STRUCT_PAGES.filter((p) => p !== 'locations')];
// 竖屏 360/375/390/414/430 + 手机横屏 844×390 / 932×430。
// 横屏宽 >767（≤1023 仍在移动档），命中的是「矮视口」那一支移动规则（styles.css: max-width:767px, max-height:500px）。
const WIDTHS = [[360, 800], [375, 667], [390, 844], [414, 896], [430, 932], [844, 390], [932, 430],
  // 平板竖屏（iPad 768×1024 / iPad Air 820×1180）：曾走桌面形态，侧栏 277 + main 491 时 feed/friendlist 表格被 clip 却滚不出来
  [768, 1024], [820, 1180]];

await assertVrcServer(BASE);

const rows = [];
const check = (page, name, ours, want, ok) => {
  rows.push({ page, name, ours, want, ok });
  if (!ok) console.log(`  ✗ ${page} ${name}: 我们 ${ours} / 期望 ${want}`);
};
let CUR = '';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function open(p, width, height) {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: false, hasTouch: true });
  await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1200);
  // 表格页首屏要等接口：thead 出来了但 tbody 还没行时，卡片化断言会拿到 tr=null（假 FAIL）
  await tab.waitForFunction(() => {
    const th = document.querySelector('thead');
    return !th || !!document.querySelector('tbody tr');
  }, { timeout: 8000 }).catch(() => {});
  return tab;
}

/** 页面几何：溢出 + 右溢元素 + 触控 + 字号 + 表格形态 */
const audit = (tab) => tab.evaluate(() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const offenders = [];
  const tap = [];
  let minFont = 99;
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    // 右溢元素：允许 1px 抖动；固定定位的抽屉关闭时在屏外（left<0），不算右溢
    if (r.width > 0 && r.right > vw + 1 && cs.position !== 'fixed') {
      offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
    }
    const text = (el.textContent || '').trim();
    if (text && r.width > 0 && r.height > 0) {
      const fs = parseFloat(cs.fontSize);
      // 图表画布/装饰不当文本
      if (fs > 0 && el.children.length === 0) minFont = Math.min(minFont, Math.round(fs * 10) / 10);
    }
    if (el.matches('button, a[href], [role="button"], input, select')) {
      if (r.width > 0 && r.height > 0) tap.push({ h: Math.round(r.height), w: Math.round(r.width), t: (el.getAttribute('aria-label') || text).slice(0, 18) });
    }
  });
  const th = document.querySelector('thead');
  const tr = document.querySelector('tbody tr');
  const main = document.querySelector('main') || document.querySelector('#root > div > div:last-child');
  return {
    vw,
    docScrollW: de.scrollWidth,
    offenders: offenders.slice(0, 6),
    minFont,
    tapMin: tap.length ? Math.min(...tap.map((x) => x.h)) : null,
    tapSmall: tap.filter((x) => x.h < 32).slice(0, 6),
    tapUnder44: [...new Map(tap.filter((x) => x.h < 44).map((x) => [x.t, x])).values()].slice(0, 10),
    theadDisplay: th ? getComputedStyle(th).display : null,
    trDisplay: tr ? getComputedStyle(tr).display : null,
    trDir: tr ? getComputedStyle(tr).flexDirection : null,
    mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
    mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
    topbarH: (() => { const t = document.querySelector('#vrc-topbar'); return t ? Math.round(t.getBoundingClientRect().height) : null; })(),
    sidebarLeft: (() => { const s = document.querySelector('.vrc-sidebar'); return s ? Math.round(s.getBoundingClientRect().left) : null; })(),
  };
});

for (const page of PAGES) {
  CUR = page;
  for (const [width, height] of WIDTHS) {
    const tab = await open(page, width, height);
    const a = await audit(tab);
    const tag = `${page}@${width}`;
    check(tag, '无横向溢出', `scrollW=${a.docScrollW} vw=${a.vw}`, '≤vw+1', a.docScrollW <= a.vw + 1);
    if (a.offenders.length) console.log(`      ${tag} 右溢元素: ${a.offenders.join(' | ')}`);
    // 无表格的页面（概览/关系图/设置等）不适用卡片化，n/a 记为通过
    const hasTable = a.theadDisplay != null;
    check(tag, hasTable ? '表格卡片化' : '表格卡片化(n/a 无表格)', `thead=${a.theadDisplay} tr=${a.trDisplay}`, 'thead=none tr=flex',
      !hasTable || (a.theadDisplay === 'none' && a.trDisplay === 'flex'));
    check(tag, '触控目标≥32', a.tapMin == null ? 'n/a' : `${a.tapMin}px`, '≥32px', a.tapMin == null || a.tapMin >= 32);
    if (a.tapSmall.length) console.log(`      过小触控: ${a.tapSmall.map((t) => `${t.t}(${t.h}px)`).join(' ')}`);
    // 390 竖屏（真机主档）列出仍 <44 的控件，作为是否继续抬阈值的依据
    if (width === 390 && a.tapUnder44.length) console.log(`      <44 触控: ${a.tapUnder44.map((t) => `${t.t}(${t.h}px)`).join(' ')}`);
    check(tag, '最小字号≥11', `${a.minFont}px`, '≥11px', a.minFont >= 11);
    check(tag, '内容区非零宽', `${a.mainW}px`, '>0', a.mainW == null || a.mainW > 0);
    check(tag, '侧栏默认收起', `left=${a.sidebarLeft}`, '<0', a.sidebarLeft == null || a.sidebarLeft < 0);
    if (height <= 500) {
      // 横屏：竖向只有 ~390px，顶栏必须瘦、内容区不能被压成 0 高
      check(tag, '横屏内容区非零高', `${a.mainH}px`, '≥200', a.mainH == null || a.mainH >= 200);
      check(tag, '横屏顶栏高度', `${a.topbarH}px`, '≤48', a.topbarH == null || a.topbarH <= 48);
    }
    await tab.close();
  }
}

// 断点两侧：1023 移动 / 1024 桌面；矮档 500 移动 / 501 桌面（宽取 1024，避免被窄档同时命中）
// 表格可能还没渲染出来（feed 首屏要等接口），先等 thead / tbody tr 出现；仍无则退到 friendlist 重开一次。
async function openWithTable(p, width, height) {
  let tab = await open(p, width, height);
  await tab.waitForFunction(() => !!document.querySelector('thead'), { timeout: 8000 }).catch(() => {});
  let has = await tab.evaluate(() => !!document.querySelector('thead'));
  if (!has) { await tab.close(); tab = await open('friendlist', width, height);
    await tab.waitForFunction(() => !!document.querySelector('thead'), { timeout: 8000 }).catch(() => {}); }
  return tab;
}

for (const [w, h, mobile] of [[1023, 900, true], [1024, 900, false], [1024, 500, true], [1024, 501, false]]) {
  const tab = await openWithTable('feed', w, h);
  const a = await audit(tab);
  check(`breakpoint@${w}x${h}`, '断点形态', `thead=${a.theadDisplay} tr=${a.trDisplay}`, mobile ? 'thead=none tr=flex' : 'thead=table-row 不是 flex',
    mobile ? (a.theadDisplay === 'none' && a.trDisplay === 'flex') : (a.theadDisplay !== 'none' && a.trDisplay !== 'flex'));
  check(`breakpoint@${w}x${h}`, '无横向溢出', `scrollW=${a.docScrollW} vw=${a.vw}`, '≤vw+1', a.docScrollW <= a.vw + 1);
  await tab.close();
}

// 移动端顶栏信息密度（friends@390）：至少 ☰ + 快速搜索两个入口，且搜索真能打开命令面板
{
  const tab = await open('friends', 390, 844);
  const bar = await tab.evaluate(() => {
    const h = document.querySelector('#vrc-topbar');
    const btns = [...h.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0);
    return { n: btns.length, labels: btns.map((b) => b.getAttribute('aria-label') || b.title || '').join('/') };
  });
  check('topbar@390', '顶栏搜索入口', `按钮 ${bar.n}: ${bar.labels}`, '≥2 且含「快速搜索」',
    bar.n >= 2 && bar.labels.includes('快速搜索'));
  const barTap = await tab.evaluate(() => {
    const bs = [...document.querySelectorAll('#vrc-topbar button')].filter((b) => b.getBoundingClientRect().width > 0);
    return { minH: Math.round(Math.min(...bs.map((b) => b.getBoundingClientRect().height))), minW: Math.round(Math.min(...bs.map((b) => b.getBoundingClientRect().width))) };
  });
  check('topbar@390', '顶栏按钮 44 命中区', `${barTap.minW}×${barTap.minH}`, '≥44×44', barTap.minH >= 44 && barTap.minW >= 44);
  await tab.click('[data-topbar="search-mobile"]');
  await tab.waitForTimeout(300);
  check('topbar@390', '搜索按钮开面板', await tab.evaluate(() => String(!!document.querySelector('[data-testid="palette"]'))), 'true',
    await tab.evaluate(() => !!document.querySelector('[data-testid="palette"]')));
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(250);
  check('topbar@390', 'Esc 关面板', await tab.evaluate(() => String(!!document.querySelector('[data-testid="palette"]'))), 'false',
    !(await tab.evaluate(() => !!document.querySelector('[data-testid="palette"]'))));
  await tab.close();
}

// 命令面板在 iOS 地址栏展开时不能顶出可视化区（模拟：把 --app-vh 压到可视高度）
for (const [w, h, vh] of [[390, 844, 560], [844, 390, 300]]) {
  const tab = await open('friends', w, h);
  await tab.click('[data-topbar="search-mobile"]');
  await tab.waitForTimeout(300);
  const fit = await tab.evaluate((vvh) => {
    document.documentElement.style.setProperty('--app-vh', `${vvh}px`);
    const p = document.querySelector('[data-testid="palette"]');
    const list = p.querySelector('.cmdk-list');
    const r = p.getBoundingClientRect();
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      listH: Math.round(list.getBoundingClientRect().height),
      maxList: Math.round(parseFloat(getComputedStyle(list).maxHeight)),
    };
  }, vh);
  const tag = `palette@${w}x${h}`;
  check(tag, `面板在可视高 ${vh} 内`, `top=${fit.top} bottom=${fit.bottom}`, `bottom≤${vh}`, fit.bottom <= vh + 1);
  check(tag, '结果列表高度按可视高算', `listH=${fit.listH} maxH=${fit.maxList}`, `maxH≤${Math.round(vh * 0.52)}`, fit.maxList <= Math.round(vh * 0.52) + 1);
  await tab.close();
}

// 表格卡片内列名/值对齐（friendlist@390）：列名宽度必须统一，否则每行值的起点都是斜的
{
  const tab = await open('friendlist', 390, 844);
  const r = await tab.evaluate(() => {
    const tr = document.querySelector('tbody tr');
    if (!tr) return null;
    const cells = [...tr.querySelectorAll('td[data-label]')];
    if (cells.length < 3) return null;
    const ws = cells.map((td) => Math.round(parseFloat(getComputedStyle(td, '::before').width)));
    const rights = cells.map((td) => Math.round(td.getBoundingClientRect().right));
    return { n: cells.length, spread: Math.max(...ws) - Math.min(...ws), w0: ws[0], rightSpread: Math.max(...rights) - Math.min(...rights) };
  });
  check('cards@390', '列名等宽/值同起点', r ? `${r.n} 格 列名 ${r.w0}px 差 ${r.spread}px` : 'n/a（无表格行）', '差≤1px',
    !r || (r.spread <= 1 && r.rightSpread <= 1));
  await tab.close();
}

// 抽屉开合（friends@390）：点 ☰ 能开、点 ✕ 能关
{
  const tab = await open('friends', 390, 844);
  const before = await tab.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(350);
  const opened = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    return { open: s?.dataset.open, left: s ? Math.round(s.getBoundingClientRect().left) : null };
  });
  await tab.click('.vrc-sidebar-close');
  await tab.waitForTimeout(350);
  const closed = await tab.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
  check('drawer@390', '☰ 打开抽屉', `left=${before}→${opened.left} data-open=${opened.open}`, 'left≥-1 且 data-open=true',
    before < 0 && opened.left >= -1 && opened.open === 'true');
  const navTap = await tab.evaluate(() => {
    const top = [...document.querySelectorAll('.vrc-sidebar > * .nav-item, .vrc-sidebar .nav-item')]
      .filter((n) => !n.closest('.nav-sub'))
      .filter((n) => n.getBoundingClientRect().height > 0);
    const sub = [...document.querySelectorAll('.vrc-sidebar .nav-sub .nav-item')].filter((n) => n.getBoundingClientRect().height > 0);
    const h = (a) => (a.length ? Math.round(Math.min(...a.map((n) => n.getBoundingClientRect().height))) : null);
    return { top: h(top), sub: h(sub), n: top.length, ns: sub.length };
  });
  check('drawer@390', '抽屉导航 ≥44/40', `顶层 ${navTap.n} 项 ${navTap.top}px / 二级 ${navTap.ns} 项 ${navTap.sub}px`, '顶层≥44 二级≥40',
    (navTap.top == null || navTap.top >= 44) && (navTap.sub == null || navTap.sub >= 40));
  check('drawer@390', '✕ 关闭抽屉', `left=${closed}`, '<0', closed < 0);
  await tab.close();
}

// 抽屉三种关闭方式 + 焦点陷阱（friends@390）：Esc / 点遮罩 / 焦点进抽屉且 Tab 不漏到背后内容区
{
  const tab = await open('friends', 390, 844);
  const asideLeft = () => tab.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
  const inSidebar = () => tab.evaluate(() => !!document.activeElement?.closest?.('.vrc-sidebar'));

  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(350);
  check('drawer@390', '打开后焦点进抽屉', String(await inSidebar()), 'true', await inSidebar());

  // Tab 走一圈（40 次，菜单项 ~20 个）不能跑到抽屉外
  let escaped = 0;
  for (let i = 0; i < 40; i += 1) {
    await tab.keyboard.press('Tab');
    if (!(await inSidebar())) escaped += 1;
  }
  check('drawer@390', 'Tab 焦点锁在抽屉内', `漏出 ${escaped}/40 次`, '0', escaped === 0);

  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(350);
  const leftEsc = await asideLeft();
  const backToMenu = await tab.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  check('drawer@390', 'Esc 关闭抽屉', `left=${leftEsc}`, '<0', leftEsc < 0);
  check('drawer@390', '关闭后焦点回 ☰', String(backToMenu), '菜单', backToMenu === '菜单');

  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(300);
  await tab.mouse.click(370, 420); // 抽屉宽 214，370 处是遮罩
  await tab.waitForTimeout(350);
  const leftOverlay = await asideLeft();
  check('drawer@390', '点遮罩关闭抽屉', `left=${leftOverlay}`, '<0', leftOverlay < 0);
  await tab.close();
}

// 横屏顶栏信息密度（844×390 / 932×430）：标题不被截断、两个按钮之间还有余量、不挤在一起
for (const [w, h] of [[844, 390], [932, 430]]) {
  const tab = await open('friends', w, h);
  const r = await tab.evaluate(() => {
    const bar = document.querySelector('#vrc-topbar');
    const h1 = bar.querySelector('h1');
    const btns = [...bar.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => b.getBoundingClientRect());
    return {
      barRight: Math.round(bar.getBoundingClientRect().right),
      titleTrunc: h1 ? h1.scrollWidth > h1.clientWidth + 1 : false,
      // 左侧 ☰ 右缘 与 右侧搜索按钮左缘 之间的空隙（这块放标题）
      gap: btns.length >= 2 ? Math.round(btns[btns.length - 1].left - btns[0].right) : null,
      maxRight: btns.length ? Math.round(Math.max(...btns.map((q) => q.right))) : null,
    };
  });
  check(`topbar@${w}x${h}`, '标题不截断', String(r.titleTrunc), 'false', r.titleTrunc === false);
  check(`topbar@${w}x${h}`, '按钮不挤出顶栏', `right=${r.maxRight} bar=${r.barRight}`, '≤bar', r.maxRight == null || r.maxRight <= r.barRight);
  check(`topbar@${w}x${h}`, '左右按钮余量', `gap=${r.gap}px`, '≥200', r.gap != null && r.gap >= 200);
  await tab.close();
}

// 设置页开关命中区（390×844 / 844×390）：按钮 44×44，中心 ±18px 仍点在开关上（轨道视觉仍是 32×18）
for (const [w, h] of [[390, 844], [844, 390]]) {
  const tab = await open('settings', w, h);
  await tab.waitForTimeout(500);
  const r = await tab.evaluate(() => {
    const el = [...document.querySelectorAll('[role="switch"]')].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return null;
    const q = el.getBoundingClientRect();
    const cx = q.left + q.width / 2;
    const cy = q.top + q.height / 2;
    const hits = (dx, dy) => { const e = document.elementFromPoint(cx + dx, cy + dy); return !!e && (e === el || el.contains(e)); };
    const track = el.querySelector('.vrc-switch-track')?.getBoundingClientRect();
    return {
      w: Math.round(q.width), h: Math.round(q.height),
      track: track ? `${Math.round(track.width)}×${Math.round(track.height)}` : null,
      hit: hits(0, -18) && hits(0, 18) && hits(-18, 0) && hits(18, 0),
    };
  });
  check(`switch@${w}x${h}`, '开关命中区 44×44', r ? `${r.w}×${r.h}（轨道 ${r.track}）` : 'n/a（无开关）', '44×44 且轨道 32×18',
    !r || (r.w === 44 && r.h === 44 && r.track === '32×18'));
  check(`switch@${w}x${h}`, '边缘 ±18px 仍命中', r ? String(r.hit) : 'n/a', 'true', !r || r.hit === true);
  await tab.close();
}

// iOS Safari 输入框防自动放大：移动形态所有可见文本框/下拉 ≥16px（12px 一聚焦就把整页放大且不还原）
// feed 量全部竖屏档；feed/sessions/settings/friendlist 覆盖带表单的几页
for (const [page, w, h] of [
  ['feed', 360, 800], ['feed', 390, 844], ['feed', 430, 932], ['feed', 844, 390],
  ['sessions', 390, 844], ['settings', 390, 844], ['friendlist', 390, 844]
]) {
  const tab = await open(page, w, h);
  await tab.waitForTimeout(600);
  const r = await tab.evaluate(() => {
    const els = [...document.querySelectorAll("input:not([type='checkbox']):not([type='radio']), select, textarea")]
      .filter((el) => (el.offsetParent !== null || el.getClientRects().length) && el.getBoundingClientRect().height > 0);
    return {
      n: els.length,
      min: els.length ? Math.min(...els.map((el) => parseFloat(getComputedStyle(el).fontSize))) : null,
      date: (() => { const d = document.querySelector("input[type='date']"); if (!d) return null; const b = d.getBoundingClientRect(); return { w: Math.round(b.width), scroll: d.scrollWidth, client: d.clientWidth }; })(),
    };
  });
  check(`${page}@${w}x${h}`, '输入框字号≥16（iOS 不放大）', r.min == null ? 'n/a' : `${r.min}px ×${r.n}`, '≥16px', r.min == null || r.min >= 16);
  check(`${page}@${w}x${h}`, '日期框容得下 16px 文本', r.date ? `${r.date.w}px 内宽 ${r.date.client}` : 'n/a', 'clientWidth≥96', !r.date || r.date.client >= 96);
  await tab.close();
}

// 安全区：把 env() 变量按刘海机/带指示条真机的值注入，量顶栏是否加高、抽屉是否让位。
// 横屏刘海在左右两侧（47px），竖屏在顶部（47）与底部（34 home 指示条）。
for (const [w, h, top, bottom, lr] of [[390, 844, 47, 34, 0], [844, 390, 0, 21, 47]]) {
  const tab = await open('friends', w, h);
  await tab.waitForTimeout(500);
  const base = await tab.evaluate(() => ({
    bar: Math.round(document.querySelector('.vrc-topbar').getBoundingClientRect().height),
    vars: ['--safe-top', '--safe-bottom', '--safe-left', '--safe-right'].map((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim()),
  }));
  const r = await tab.evaluate(([t, b, x]) => {
    document.documentElement.style.setProperty('--safe-top', `${t}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${b}px`);
    document.documentElement.style.setProperty('--safe-left', `${x}px`);
    document.documentElement.style.setProperty('--safe-right', `${x}px`);
    const bar = document.querySelector('.vrc-topbar');
    const sd = document.querySelector('.vrc-sidebar');
    const sb = document.querySelector('#vrc-statusbar');
    const sbBox = sb.getBoundingClientRect();
    return {
      barPadL: parseFloat(getComputedStyle(bar).paddingLeft),
      barPadR: parseFloat(getComputedStyle(bar).paddingRight),
      mainPadL: parseFloat(getComputedStyle(document.querySelector('main')).paddingLeft),
      sdPadL: parseFloat(getComputedStyle(sd).paddingLeft),
      sbPadBottom: parseFloat(getComputedStyle(sb).paddingBottom),
      // 抽屉底边整体上移到状态栏上沿（不再靠 padding 让位），两者不能重叠
      sdBottom: Math.round(sd.getBoundingClientRect().bottom),
      sbTop: Math.round(sbBox.top),
      // 内容（图标/文字行）底边到视口底边的余量：home 指示条就压在这段里
      sbGap: sb.firstElementChild ? Math.round(window.innerHeight - sb.firstElementChild.getBoundingClientRect().bottom) : -1,
      over: getComputedStyle(document.querySelector('.workspace > div')).overscrollBehaviorY,
      barH: Math.round(bar.getBoundingClientRect().height),
      barPad: parseFloat(getComputedStyle(bar).paddingTop),
      sdPadTop: parseFloat(getComputedStyle(sd).paddingTop),
      sdPadBottom: parseFloat(getComputedStyle(sd).paddingBottom),
    };
  }, [top, bottom, lr]);
  check(`safe-area@${w}x${h}`, '安全区变量已定义', base.vars.join('/'), '全是长度值（0px 起）', base.vars.every((v) => /px$/.test(v)));
  check(`safe-area@${w}x${h}`, '顶栏让出刘海', `bar=${r.barH} pad=${r.barPad}（无刘海 ${base.bar}）`, `=44+${top} 且 pad=${top}`,
    r.barPad === top && r.barH >= 44 + top - 0.5 && r.barH <= 44 + top + 0.5);
  check(`safe-area@${w}x${h}`, '抽屉上边让出刘海', `top=${r.sdPadTop} bottom=${r.sdBottom} 状态栏顶=${r.sbTop}`, `top=${top} 且 抽屉底≤状态栏顶`,
    r.sdPadTop === top && r.sdBottom <= r.sbTop);
  check(`safe-area@${w}x${h}`, '抽屉左右让位（横屏刘海）', `left=${r.sdPadL}`, `left=${lr}`,
    r.sdPadL === lr);
  check(`safe-area@${w}x${h}`, '顶栏左右让位（横屏刘海）', `left=${r.barPadL} right=${r.barPadR}`, `left=${14 + lr} right=${8 + lr}`,
    r.barPadL === 14 + lr && r.barPadR === 8 + lr);
  check(`safe-area@${w}x${h}`, '内容区左右让位', `main padding-left=${r.mainPadL}`, `${lr}`,
    r.mainPadL === lr);
  check(`safe-area@${w}x${h}`, '状态栏不被 home 指示条盖住', `内容底边距=${r.sbGap}px pad=${r.sbPadBottom}`, `≥${bottom} 且 pad=${bottom}`,
    r.sbGap >= bottom - 0.5 && r.sbPadBottom === bottom);
  check(`safe-area@${w}x${h}`, '滚动不外溢（不发下拉刷新）', r.over, 'contain', r.over === 'contain');
  await tab.close();
}

// 旋转残留（390×844 开抽屉 → 1024×768 桌面形态）：抽屉消失后 data-open 必须清掉、焦点陷阱卸载、Esc 不改状态；
// 转回 390 时抽屉默认收起。此前 bug：data-open 残留 true，桌面连按 Tab 焦点全锁在侧栏，Esc 还能「关」一次桌面侧栏。
{
  const tab = await open('friends', 390, 844);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(350);
  const before = await tab.evaluate(() => document.querySelector('.vrc-sidebar')?.dataset.open);
  await tab.setViewportSize({ width: 1024, height: 768 });
  await tab.waitForTimeout(600);
  const desk = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    const b = s.getBoundingClientRect();
    const items = [...s.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')]
      .filter((n) => n.getBoundingClientRect().width > 0);
    items[items.length - 1]?.focus();
    return { open: s.dataset.open, left: Math.round(b.left), width: Math.round(b.width), items: items.length };
  });
  await tab.keyboard.press('Tab');
  const tabbed = await tab.evaluate(() => ({
    inside: !!document.activeElement?.closest?.('.vrc-sidebar'),
    what: document.activeElement?.getAttribute?.('aria-label') || document.activeElement?.textContent?.trim().slice(0, 8),
  }));
  check('rotate@390→1024', '开抽屉后转桌面：data-open 清掉', `打开时 ${before} → 转后 ${desk.open}`, 'false', desk.open === 'false');
  check('rotate@390→1024', '桌面侧栏常驻可见', `left=${desk.left} w=${desk.width}`, 'left=0', desk.left === 0);
  check('rotate@390→1024', '焦点陷阱已卸载（Tab 能出侧栏）', `${desk.items} 项，末项 Tab 后 → ${tabbed.what}（侧栏内=${tabbed.inside}）`, 'false', tabbed.inside === false);
  await tab.keyboard.press('Escape');
  await tab.waitForTimeout(300);
  const afterEsc = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    return { open: s.dataset.open, left: Math.round(s.getBoundingClientRect().left) };
  });
  check('rotate@390→1024', '桌面 Esc 不改抽屉状态', `data-open=${afterEsc.open} left=${afterEsc.left}`, 'false/0',
    afterEsc.open === 'false' && afterEsc.left === 0);
  await tab.setViewportSize({ width: 390, height: 844 });
  await tab.waitForTimeout(600);
  const back = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    return { open: s.dataset.open, left: Math.round(s.getBoundingClientRect().left) };
  });
  check('rotate@390→1024', '转回 390 抽屉默认收起', `data-open=${back.open} left=${back.left}`, 'false 且 <0',
    back.open === 'false' && back.left < 0);
  await tab.close();
}

// 横屏抽屉底边 / 状态栏：抽屉不再盖住状态栏，底部「收起导航栏」也不压状态栏文字
for (const [w, h] of [[844, 390], [932, 430]]) {
  const tab = await open('friends', w, h);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(350);
  const r = await tab.evaluate(() => {
    const sd = document.querySelector('.vrc-sidebar').getBoundingClientRect();
    const sbEl = document.querySelector('#vrc-statusbar');
    const sb = sbEl.getBoundingClientRect();
    const btn = document.querySelector('[data-testid="nav-collapse"]')?.getBoundingClientRect();
    const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('#vrc-statusbar') ? 'statusbar' : (e.closest('[data-testid="nav-collapse"]') ? 'collapse' : e.tagName)) : 'null'; };
    return {
      sdBottom: Math.round(sd.bottom), sbTop: Math.round(sb.top),
      btnBottom: btn ? Math.round(btn.bottom) : null,
      hitStatus: hit(100, sb.top + sb.height / 2),      // 抽屉脚下、状态栏行上
      hitBtn: hit(100, btn ? btn.top + btn.height / 2 : 0),
    };
  });
  check(`drawer-landscape@${w}x${h}`, '抽屉不压状态栏', `抽屉底=${r.sdBottom} 状态栏顶=${r.sbTop}`, '≤', r.sdBottom <= r.sbTop);
  check(`drawer-landscape@${w}x${h}`, '收起按钮不压状态栏', `按钮底=${r.btnBottom} 状态栏顶=${r.sbTop}`, '≤', r.btnBottom == null || r.btnBottom <= r.sbTop);
  check(`drawer-landscape@${w}x${h}`, '状态栏区不被按钮吃掉', `y=状态栏中点命中 ${r.hitStatus}`, '≠collapse', r.hitStatus !== 'collapse');
  check(`drawer-landscape@${w}x${h}`, '收起按钮本身仍可点', `按钮中点命中 ${r.hitBtn}`, 'collapse', r.hitBtn === 'collapse');
  await tab.close();
}

await browser.close();

const fail = rows.filter((r) => !r.ok);
const pct = ((rows.length - fail.length) / rows.length * 100).toFixed(1);
console.log(`\n${rows.length - fail.length}/${rows.length} PASS (${pct}%)  页面 ${PAGES.length} × 视口 ${WIDTHS.length + 1}（+抽屉/断点）`);
if (fail.length) {
  console.log('\nFAIL 汇总:');
  for (const f of fail) console.log(`  ${f.page} · ${f.name}: ${f.ours}（期望 ${f.want}）`);
  process.exit(1);
}
console.log('MOBILE OK');