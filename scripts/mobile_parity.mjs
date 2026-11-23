/**
 * 移动端断点回归：把「移动端长什么样」变成可量的数字，而不是看图说话。
 *
 *   node scripts/mobile_parity.mjs [baseUrl] [--all]
 *
 * 覆盖 STRUCT_PAGES + friends（13 页）× 10 个移动视口（360/375/390/414/430 竖屏 + 844×390/932×430 横屏 + 768×1024/820×1180 平板竖屏），
 * 外加 1023 / 1024 与 1024×500 / 1024×501 两对「断点两侧」检查（窄≤1023/矮≤500 → 移动形态，否则桌面形态），
 * 以及软键盘（visualViewport 压矮）、320 极窄状态栏、命中遮挡等单点检查。
 *
 * 每页断言：
 *   1) 无横向溢出：documentElement.scrollWidth ≤ innerWidth+1，且列出右溢元素
 *   2) 表格卡片化（≤1023 或矮≤500）：thead display:none、tbody tr display:flex/flex-direction:column
 *      ≥1024：thead 可见、tbody tr 不是 flex 卡片
 *   3) 触控目标分层：顶栏/抽屉导航 ≥44、chip/表单 ≥36、行内与表格 ≥32
 *   4) 字号：可见文本最小字号 ≥ 11；表单控件 ≥16（iOS 聚焦自动放大）
 *   5) 抽屉：默认移出视口；☰/✕/Esc/遮罩都能关；焦点陷阱；关闭后焦点回 ☰
 *   6) 内容区不被压成 0 宽；安全区（刘海/home 条）让位；命令面板按 --app-vh 算高
 *   7) 长列表滚动位置在抽屉开合/旋转后保持；极端数据（超长昵称/缺头像/空值）不撑破卡片
 *   8) sessions 搜索模式：点「搜索」段后出框（16px/≥36 命中/中心可点/真过滤），键盘弹出后仍在可视区
 *   9) 触控降档定档（13 页 @390）：<36 只允许出现在白名单（表格行内/分段按钮/二级导航/静态标签）
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
  const occluded = [];
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
      if (r.width > 0 && r.height > 0) {
        const layer = el.closest('#vrc-topbar') ? 'topbar' : el.closest('.vrc-sidebar') ? 'nav'
          : el.matches('.chip') ? 'chip' : el.matches('input, select') ? 'field' : 'rest';
        tap.push({ h: Math.round(r.height), w: Math.round(r.width), t: (el.getAttribute('aria-label') || text).slice(0, 18), layer });
      }
    }
    // 命中区是否被后续内容盖住：表单控件/行内按钮若溢出定高容器，后面的表格/卡片会画在它上面，
    // 手指点中心命中的就是别的东西（feed 搜索框曾被表格行盖住，点它毫无反应）。
    if (el.matches('input, select, .chip') && r.width > 0 && r.height > 0
      && r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        occluded.push(`${el.tagName.toLowerCase()}${el.getAttribute('placeholder') ? `[${el.getAttribute('placeholder')}]` : ''} ← ${hit.tagName.toLowerCase()}.${(hit.className || '').toString().split(' ')[0]}`);
      }
    }
  });
  const th = document.querySelector('thead');
  const tr = document.querySelector('tbody tr');
  const main = document.querySelector('main') || document.querySelector('#root > div > div:last-child');
  const minOf = (layer) => {
    const hs = tap.filter((x) => x.layer === layer).map((x) => x.h);
    if (!hs.length) return null;
    const m = Math.min(...hs);
    return { h: m, worst: [...new Map(tap.filter((x) => x.layer === layer && x.h < m + 1).map((x) => [x.t, x])).values()].slice(0, 3) };
  };
  return {
    vw,
    docScrollW: de.scrollWidth,
    offenders: offenders.slice(0, 6),
    minFont,
    tapMin: tap.length ? Math.min(...tap.map((x) => x.h)) : null,
    layers: { topbar: minOf('topbar'), nav: minOf('nav'), chip: minOf('chip'), field: minOf('field'), rest: minOf('rest') },
    tapSmall: tap.filter((x) => x.h < 32).slice(0, 6),
    tapUnder44: [...new Map(tap.filter((x) => x.h < 44).map((x) => [x.t, x])).values()].slice(0, 10),
    occluded: occluded.slice(0, 6),
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
    if (width === 390) {
      // 分层命中区（真机主档逐页）：chip 与表单控件 36、其余（表格单元格/行内链接）32；顶栏与抽屉导航另有 44 断言
      const L = a.layers;
      const fmt = (x) => (x ? `${x.h}px${x.worst.length ? ' ' + x.worst.map((t) => `${t.t}(${t.h})`).join(' ') : ''}` : 'n/a');
      check(tag, 'chip 命中区≥36', fmt(L.chip), '≥36px', !L.chip || L.chip.h >= 36);
      check(tag, '表单控件≥36', fmt(L.field), '≥36px', !L.field || L.field.h >= 36);
      check(tag, '行内/表格目标≥32', fmt(L.rest), '≥32px', !L.rest || L.rest.h >= 32);
      // 表单控件中心必须点得到自己：溢出定高容器被后面内容盖住时，手指点上去命中别的元素
      check(tag, '表单控件中心可点（未被遮挡）', a.occluded.length ? a.occluded.join(' | ') : '0 处遮挡', '0', a.occluded.length === 0);
    }
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
  // 抽屉导航文字可读性：13px/12px 灰字在 245 底上实测 6.73:1，锁 ≥4.5:1 防回退
  const contrast = await tab.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (!c || c === 'rgba(0, 0, 0, 0)') continue;
        const x = rgba(c);
        if (x.a > 0) layers.push(x);
      }
      let o = { r: 255, g: 255, b: 255 };
      for (const x of layers.reverse()) o = { r: x.r * x.a + o.r * (1 - x.a), g: x.g * x.a + o.g * (1 - x.a), b: x.b * x.a + o.b * (1 - x.a) };
      return o;
    };
    const items = [...document.querySelectorAll('.vrc-sidebar .nav-item')].filter((n) => n.getBoundingClientRect().width > 0);
    const rs = items.map((n) => {
      const L1 = lum(rgba(getComputedStyle(n).color)), L2 = lum(bgOf(n));
      return Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100;
    });
    return { min: Math.min(...rs), n: items.length, fontMin: Math.min(...items.map((n) => parseFloat(getComputedStyle(n).fontSize))) };
  });
  check('drawer@390', '导航文字对比度≥4.5:1', `${contrast.min}:1（${contrast.n} 项，最小字号 ${contrast.fontMin}px）`, '≥4.5:1',
    contrast.min >= 4.5);
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

// 长列表滚动位置：开合抽屉、旋转屏幕后不能跳回顶部（真机最烦的丢失阅读位置）；深滚 30 次耗时锁 300ms 防布局抖动
for (const [page, w, h] of [['friendlist', 390, 844], ['feed', 390, 844]]) {
  const tab = await open(page, w, h);
  await tab.waitForTimeout(800);
  const SCROLLER = `(() => {
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY)) continue;
      if (el.scrollHeight - el.clientHeight > 40 && (!best || el.scrollHeight > best.scrollHeight)) best = el;
    }
    return best;
  })()`;
  const top = () => tab.evaluate(([src]) => { const b = eval(src); return b ? Math.round(b.scrollTop) : -1; }, [SCROLLER]);
  const start = await tab.evaluate(([src]) => {
    const b = eval(src); if (!b) return null;
    b.scrollTop = 250;
    return { top: Math.round(b.scrollTop), sh: b.scrollHeight, ch: b.clientHeight, rows: document.querySelectorAll('tbody tr').length };
  }, [SCROLLER]);
  const tag = `scroll@${page}@${w}`;
  if (!start) { check(tag, '有可滚容器', 'n/a', '存在', false); await tab.close(); continue; }
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  await tab.click('.vrc-sidebar-close');
  await tab.waitForTimeout(500);
  const afterDrawer = await top();
  check(tag, '开合抽屉后滚动位置保持', `${start.top}→${afterDrawer}`, `±2px`, Math.abs(afterDrawer - start.top) <= 2);
  await tab.setViewportSize({ width: 844, height: 390 });
  await tab.waitForTimeout(700);
  await tab.setViewportSize({ width: w, height: h });
  await tab.waitForTimeout(700);
  const afterRotate = await top();
  check(tag, '旋转回竖屏后滚动位置保持', `${start.top}→${afterRotate}`, `±2px`, Math.abs(afterRotate - start.top) <= 2);
  const perf = await tab.evaluate(([src]) => {
    const b = eval(src); if (!b) return null;
    const t0 = performance.now();
    for (let i = 0; i < 30; i += 1) b.scrollTop = (i * 97) % Math.max(1, b.scrollHeight - b.clientHeight);
    b.getBoundingClientRect();
    return Math.round(performance.now() - t0);
  }, [SCROLLER]);
  check(tag, '30 次深滚 ≤300ms', `${perf}ms（${start.rows} 行）`, '≤300ms', perf != null && perf <= 300);
  await tab.close();
}

// 表格卡片化后的极端数据（360 宽）：超长昵称写进真实 truncate 容器、头像缺失、末格空值
// —— 要求页面不被撑破；内容要么换行、要么省略号裁剪，不能画到卡片外
for (const page of ['friendlist', 'feed']) {
  const tab = await open(page, 360, 800);
  await tab.waitForTimeout(600);
  const r = await tab.evaluate(() => {
    const tr = document.querySelector('tbody tr');
    if (!tr) return null;
    const clone = tr.cloneNode(true);
    const tds = [...clone.querySelectorAll('td')];
    // 昵称：找最深且 truncate/wrap 的近文本元素写入，保留原有裁剪容器
    const nameTd = tds.find((td) => /昵称|玩家/.test(td.dataset.label || ''));
    const host = nameTd && (nameTd.querySelector('.truncate') || nameTd.querySelector('button') || nameTd.lastElementChild || nameTd);
    if (host) host.textContent = '异常漫长的昵称'.repeat(14);
    // 头像缺失
    clone.querySelectorAll('img, .avatar').forEach((n) => n.remove());
    // 末格空值
    if (tds[tds.length - 1]) tds[tds.length - 1].textContent = '';
    tr.parentElement.insertBefore(clone, tr.nextSibling);
    const vw = document.documentElement.clientWidth;
    const row = clone.getBoundingClientRect();
    const cells = [...clone.querySelectorAll('td')].map((td) => {
      const b = td.getBoundingClientRect();
      const cs = getComputedStyle(td);
      const inner = td.querySelector('.truncate, .avatar');
      return {
        label: td.dataset.label,
        right: Math.round(b.right),
        clippedOut: b.right > vw + 1,
        // 溢出但父级不裁剪 = 文字画到卡片外
        leaks: td.scrollWidth > td.clientWidth + 1 && !/(hidden|clip|auto|scroll)/.test(cs.overflowX)
          && !(inner && /hidden/.test(getComputedStyle(inner).overflowX)),
        textOverflow: cs.textOverflow,
        truncated: td.scrollWidth > td.clientWidth + 1 && /ellipsis/.test(cs.textOverflow),
      };
    });
    const nameCell = cells.find((c) => /昵称|玩家/.test(c.label || ''));
    return {
      docW: document.documentElement.scrollWidth, vw,
      rowW: Math.round(row.width), rowH: Math.round(row.height),
      cells, leaks: cells.filter((c) => c.leaks).map((c) => c.label),
      clipped: cells.filter((c) => c.clippedOut).map((c) => `${c.label}:${c.right}`),
      nameTrunc: nameCell ? nameCell.truncated : null,
    };
  });
  const tag = `extreme@${page}@360`;
  check(tag, '超长昵称不撑破页面', r ? `scrollW=${r.docW} vw=${r.vw}` : 'n/a（无表格行）', '≤vw+1', !r || r.docW <= r.vw + 1);
  check(tag, '卡片行不超出容器', r ? `row=${r.rowW} 越界格 ${r.clipped.join(',') || '无'}` : 'n/a', '无越界', !r || r.clipped.length === 0);
  check(tag, '长文本不画到卡片外', r ? r.leaks.join(',') || '无泄漏' : 'n/a', '无泄漏', !r || r.leaks.length === 0);
  check(tag, '超长昵称被省略或换行', r ? `truncate=${r.nameTrunc} 行高=${r.rowH}` : 'n/a', 'true 或行高>44', !r || r.nameTrunc === true || r.rowH > 44);
  await tab.close();
}

// 软键盘（iOS）：键盘弹出时只有 visualViewport 变矮，layout viewport（100% / 100dvh）不变。
// Chromium 没键盘，用 defineProperty 把 visualViewport.height 压到 380 并派发 resize 模拟。
// 要求：外壳高度跟着 visualViewport 缩（否则底部状态栏和列表底部被键盘盖死且滚不出来）、
// 聚焦的搜索框仍在可视区内、键盘收起后恢复原高；桌面形态不介入（地址栏伸缩不是键盘）。
for (const page of ['feed', 'friends']) {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1400);
  await tab.waitForFunction(() => {
    const th = document.querySelector('thead');
    return !!document.querySelector('#root > div') && (!th || !!document.querySelector('tbody tr'));
  }, { timeout: 15000 }).catch(() => {});
  await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
  const sel = page === 'feed' ? '[data-testid="feed-search"]' : 'input[placeholder*="搜索"]';
  await tab.locator(sel).first().click({ timeout: 5000 }).catch(() => {});
  await tab.waitForTimeout(150);
  const focused = await tab.evaluate((s) => document.querySelector(s) === document.activeElement, sel);
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 380 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(500);
  const kb = await tab.evaluate((s) => {
    const shell = document.querySelector('#root > div');
    const sb = document.querySelector('#vrc-statusbar');
    const inp = document.querySelector(s);
    return {
      appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      shell: shell ? Math.round(shell.getBoundingClientRect().height) : null,
      sbBottom: sb ? Math.round(sb.getBoundingClientRect().bottom) : null,
      sbH: sb ? Math.round(sb.getBoundingClientRect().height) : null,
      inpBottom: inp ? Math.round(inp.getBoundingClientRect().bottom) : null,
      // 竖屏堆叠卡片不受横屏紧凑规则影响：首卡应仍是 6 行（标题 + 5 格各占一行）
      // 堆叠卡片：非标题格也占满整行（紧凑两列时只占一半）→ 用它判「横屏紧凑规则没漏到竖屏」
      cellRatio: (() => {
        const tr = document.querySelector('tbody tr'); if (!tr) return null;
        const tds = [...tr.querySelectorAll('td')]; const rowW = tr.getBoundingClientRect().width;
        const cells = tds.slice(1).filter((td) => td.getBoundingClientRect().width > 0);
        return !cells.length || !rowW ? null : Math.round(Math.max(...cells.map((td) => td.getBoundingClientRect().width)) / rowW * 100);
      })(),
    };
  }, sel);
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    delete vv.height;
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(400);
  const back = await tab.evaluate(() => ({
    appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
    shell: Math.round(document.querySelector('#root > div')?.getBoundingClientRect().height ?? -1)
  }));
  const tag = `keyboard@${page}@390`;
  check(tag, '键盘弹出前搜索框点得到', String(focused), 'true', focused === true);
  check(tag, '外壳高度跟随 visualViewport', `${kb.appVh} shell=${kb.shell}`, '380px / ≤381', /^380px$/.test(kb.appVh) && kb.shell != null && kb.shell <= 381);
  check(tag, '状态栏不被键盘盖住', `bottom=${kb.sbBottom}`, '≤381', kb.sbBottom != null && kb.sbBottom <= 381);
  check(tag, '聚焦输入框在可视区内', `bottom=${kb.inpBottom}`, '≤381', kb.inpBottom != null && kb.inpBottom <= 381);
  check(tag, '收起键盘恢复原高', `${back.appVh} shell=${back.shell}`, 'dvh / 844', /dvh/.test(back.appVh) && back.shell === 844);
  // 横屏紧凑规则（状态栏让位 + 卡片两列）只限矮视口：竖屏键盘弹起后仍有 ~430px，堆叠卡片更好读
  if (page === 'feed') {
    check(tag, '竖屏键盘下状态栏不清除', `sb.h=${kb.sbH}`, '≥35', kb.sbH != null && kb.sbH >= 35);
    check(tag, '竖屏键盘下卡片仍堆叠', `非标题格宽 ${kb.cellRatio}% 行宽`, '≥80%', kb.cellRatio == null || kb.cellRatio >= 80);
  }
  await tab.close();
}
// iOS 键盘还会把可视区整体上卷（visualViewport.offsetTop>0）：layout viewport 不动，
// 顶栏曾被顶到屏外（top=0 而可视顶边在 120），底部状态栏落到可视区外。外壳按 offsetTop 下移修掉。
for (const [top, tag] of [[120, 'kb-offset@120'], [400, 'kb-offset@400']]) {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2, isMobile: true });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1400);
  await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.evaluate((t) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 380 });
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => t });
    vv.dispatchEvent(new Event('resize'));
    vv.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
  }, top);
  await tab.waitForTimeout(500);
  const d = await tab.evaluate(() => {
    const r = (s) => { const el = document.querySelector(s); const b = el?.getBoundingClientRect(); return b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) } : null; };
    return { vvTop: Math.round(window.visualViewport.offsetTop || 0), vvH: Math.round(window.visualViewport.height), topbar: r('#vrc-topbar'), sb: r('#vrc-statusbar'), main: r('main'), shift: getComputedStyle(document.querySelector('#vrc-shell')).transform };
  });
  check(tag, '顶栏落在可视区顶边（不被上卷顶出屏外）', `topbar.top=${d.topbar?.top} vvTop=${d.vvTop}`, '≈vvTop', !!d.topbar && Math.abs(d.topbar.top - d.vvTop) <= 2);
  check(tag, '状态栏不越出可视区底边', `sb.bottom=${d.sb?.bottom} 可视底=${d.vvTop + d.vvH}`, '≤可视底', !!d.sb && d.sb.bottom <= d.vvTop + d.vvH + 1);
  check(tag, '内容区仍非零高', `main.h=${d.main?.h}`, '≥100', !!d.main && d.main.h >= 100);
  await tab.evaluate(() => { const vv = window.visualViewport; delete vv.height; delete vv.offsetTop; vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); });
  await tab.waitForTimeout(400);
  const back = await tab.evaluate(() => {
    const sh = document.querySelector('#vrc-shell')?.getBoundingClientRect();
    return { top: Math.round(sh?.top ?? -1), kb: document.documentElement.dataset.kb || null, shift: getComputedStyle(document.querySelector('#vrc-shell')).transform };
  });
  check(tag, '收起键盘后位移归零', `shell.top=${back.top} kb=${back.kb} shift=${back.shift}`, 'top=0 无位移', back.top === 0 && !back.kb && (back.shift === 'none' || back.shift === 'matrix(1, 0, 0, 1, 0, 0)'));
  await tab.close();
}

// 横屏 + 键盘同时存在（844×390 键盘 ~220 → 可视 170，只剩顶栏44+状态栏35）：内容区不能被压成 0，
// 抽屉在极矮可视区里仍要能滚到最后一项（否则横屏输入时导航全死）。
for (const [w, h, kb] of [[844, 390, 220], [932, 430, 240]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2, isMobile: true });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1400);
  await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.evaluate((hh) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, h - kb);
  await tab.waitForTimeout(500);
  const g = await tab.evaluate(() => {
    const r = (s) => { const el = document.querySelector(s); const b = el?.getBoundingClientRect(); return b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) } : null; };
    const rows = [...document.querySelectorAll('tbody tr')];
    const vvH = Math.round(window.visualViewport.height);
    const vis = rows.filter((x) => { const b = x.getBoundingClientRect(); return b.height > 0 && b.top >= 0 && b.bottom <= vvH; });
    const first = rows[0];
    const firstTops = first ? [...new Set([...first.querySelectorAll('td')].map((td) => Math.round(td.getBoundingClientRect().top)))].length : null;
    // 内容区自己的滚动容器（卡片列表）：还能不能往下滚看后面的搜索结果
    const scroller = [...document.querySelectorAll('main *')].find((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 20);
    let scrolled = null;
    if (scroller) { scroller.scrollTop = 400; scrolled = Math.round(scroller.scrollTop); }
    return {
      vvH, appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      topbar: r('#vrc-topbar'), sb: r('#vrc-statusbar'), main: r('main'), toolbar: r('.feed-toolbar'),
      rowH: first ? Math.round(first.getBoundingClientRect().height) : null,
      rows: rows.length, rowsFullyVisible: vis.length, firstTops,
      scrolled, scrollable: scroller ? scroller.scrollHeight > scroller.clientHeight + 20 : false,
      search: r('[data-testid="feed-search"]'),
    };
  });
  await tab.evaluate(() => document.querySelector('[aria-label="菜单"]')?.click());
  await tab.waitForTimeout(300);
  const dr = await tab.evaluate(() => {
    const bar = document.querySelector('.vrc-sidebar');
    if (!bar) return null;
    const items = [...bar.querySelectorAll('.nav-item')];
    const scroller = [...bar.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) || bar;
    scroller.scrollTop = scroller.scrollHeight;
    const last = items[items.length - 1]?.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { n: items.length, client: scroller.clientHeight, scroll: scroller.scrollHeight, barBottom: Math.round(b.bottom), lastBottom: last ? Math.round(last.bottom) : null, scrollerBottom: Math.round(scroller.getBoundingClientRect().bottom) };
  });
  const tag = `kb-landscape@${w}x${h}`;
  check(tag, '外壳跟随可视高', `appVh=${g.appVh} vvH=${g.vvH}`, `${g.vvH}px`, g.appVh === `${g.vvH}px`);
  check(tag, '顶栏与状态栏都在可视区内', `topbar=${g.topbar?.h} sb.bottom=${g.sb?.bottom} 可视=${g.vvH}`, 'sb.bottom≤vvH', !!g.sb && g.sb.bottom <= g.vvH + 1 && !!g.topbar && g.topbar.top === 0);
  check(tag, '内容区未被压成 0', `main.h=${g.main?.h}`, '≥60', !!g.main && g.main.h >= 60);
  // 键盘弹出期间的空间分配：顶栏 36、状态栏让位（visibility 只是装饰）、工具条只留搜索框，
  // 保证「搜索结果显示得出来」——此前 44+35+58 吃光高度，表格区 33px、一张卡都看不全。
  check(tag, '顶栏压到 36（让位给结果）', `topbar.h=${g.topbar?.h}`, '36', !!g.topbar && g.topbar.h === 36);
  check(tag, '状态栏让出高度', `sb.h=${g.sb?.h}`, '0', !g.sb || g.sb.h === 0);
  check(tag, '工具条只留搜索框', `toolbar.h=${g.toolbar?.h} 搜索框=${g.search?.h}px`, '≤48 且搜索框≥36',
    (!g.toolbar || g.toolbar.h <= 48) && (!g.search || g.search.h >= 36));
  check(tag, '至少一张卡片完整可见', `${g.rowsFullyVisible}/${g.rows} 张完整（卡片 ${g.rowH}px，可视 ${g.vvH}）`, '≥1',
    g.rowsFullyVisible >= 1);
  check(tag, '卡片压成两列（标题独占一行）', `首卡 ${g.firstTops} 行文本`, '≤4 行', g.firstTops == null || g.firstTops <= 4);
  check(tag, '结果列表可继续下滚', g.scrolled == null ? 'n/a（未找到滚动容器）' : `scrollTop→${g.scrolled}`, '>0',
    g.scrolled == null || g.scrolled > 0);
  check(tag, '抽屉在极矮可视区可滚到最后项', dr ? `n=${dr.n} client=${dr.client} scroll=${dr.scroll} lastBottom=${dr.lastBottom} scrollerBottom=${dr.scrollerBottom}` : 'n/a', '可滚且末项在容器内',
    !!dr && (dr.scroll <= dr.client + 2 || (dr.lastBottom != null && dr.lastBottom <= dr.scrollerBottom + 2)));
  await tab.close();
}

{
  const tab = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: false });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForFunction(() => !!document.querySelector('#root > div'), { timeout: 15000 }).catch(() => {});
  await tab.waitForTimeout(600);
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 600 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(400);
  const d = await tab.evaluate(() => ({
    appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
    shell: document.querySelector('#root > div') ? Math.round(document.querySelector('#root > div').getBoundingClientRect().height) : null
  }));
  check('keyboard@desktop@1440', '桌面不跟随视觉视口缩矮', `${d.appVh} shell=${d.shell}`, 'dvh / 900', /dvh/.test(d.appVh) && d.shell === 900);
  await tab.close();
}

// 底部状态栏在极窄屏的信息完整性：320（iPhone SE 初代）曾把最右 SteamVR 段裁掉 17px 且滚不出来。
// 判据：最后一段的右缘不越过状态栏右缘；横向无不可滚的溢出（scrollWidth ≤ clientWidth+1）。
for (const [w, h] of [[320, 568], [360, 800], [390, 844]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1300);
  const sb = await tab.evaluate(() => {
    const bar = document.querySelector('#vrc-statusbar');
    if (!bar) return null;
    const items = [...bar.querySelectorAll('[data-status-item]')];
    const last = items[items.length - 1];
    const r = bar.getBoundingClientRect();
    return {
      n: items.length,
      lastRight: last ? Math.round(last.getBoundingClientRect().right) : null,
      barRight: Math.round(r.right),
      client: bar.clientWidth, scroll: bar.scrollWidth,
      gap: getComputedStyle(bar).columnGap,
    };
  });
  const tag = `statusbar@${w}`;
  check(tag, '最后一段不被裁', sb ? `${sb.n} 段 lastRight=${sb.lastRight} barRight=${sb.barRight} gap=${sb.gap}` : 'n/a', 'lastRight≤barRight',
    !sb || sb.lastRight == null || sb.lastRight <= sb.barRight + 1);
  check(tag, '横向无不可滚溢出', sb ? `scrollW=${sb.scroll} clientW=${sb.client}` : 'n/a', '≤client+1', !sb || sb.scroll <= sb.client + 1);
  await tab.close();
}

// sessions 页搜索模式：默认「按日」不渲染输入框（探针 found:false 是页面默认态不是 bug）。
// 点「搜索」段后：框 16px（iOS 不放大）、命中区 ≥36、中心点得到自己、真能过滤；
// 键盘弹出（可视高 380）后输入框仍在可视区内、列表底部不越可视底、收起恢复。
for (const [w, h] of [[390, 844], [360, 800], [844, 390]]) {
  const tag = `sessions-search@${w}x${h}`;
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/sessions`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1500);
  const before = await tab.evaluate(() => ({
    inputs: document.querySelectorAll('.sess-search input').length,
    rows: document.querySelectorAll('.sess-row').length,
  }));
  check(tag, '默认按日无搜索框', `输入框 ${before.inputs}`, '0', before.inputs === 0);

  await tab.evaluate(() => [...document.querySelectorAll('.sess-seg button')].find((b) => b.textContent.trim() === '搜索')?.click());
  await tab.waitForTimeout(300);
  const m = await tab.evaluate(() => {
    const inp = document.querySelector('.sess-search input');
    if (!inp) return { found: false };
    const r = inp.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return {
      found: true, h: Math.round(r.height), font: parseFloat(getComputedStyle(inp).fontSize),
      hitSelf: !!hit && (hit === inp || inp.contains(hit)),
      hitWhat: hit ? `${hit.tagName.toLowerCase()}.${(hit.className || '').toString().split(' ')[0]}` : null,
    };
  });
  check(tag, '搜索段出「搜索房间」框', m.found ? `aria-label=${await tab.evaluate(() => document.querySelector('.sess-search input')?.getAttribute('aria-label'))}` : '未出现', '存在', !!m.found);
  check(tag, '搜索框字号≥16', m.found ? `${m.font}px` : 'n/a', '≥16px', !m.found || m.font >= 16);
  check(tag, '搜索框命中区≥36', m.found ? `${m.h}px` : 'n/a', '≥36px', !m.found || m.h >= 36);
  check(tag, '搜索框中心可点', m.found ? `命中 ${m.hitWhat}` : 'n/a', 'input', !m.found || m.hitSelf);
  // 真过滤：输入房名片段后行数减少且每行都含该片段
  await tab.fill('.sess-search input', 'Alpha').catch(() => {});
  await tab.waitForTimeout(400);
  const filt = await tab.evaluate(() => {
    const rows = [...document.querySelectorAll('.sess-row')];
    const names = rows.map((r) => r.querySelector('.sess-name')?.textContent || '');
    return { total: rows.length, miss: names.filter((n) => !/Alpha/i.test(n)).length };
  });
  check(tag, '输入即过滤（行数减少且全命中）', `${before.rows}→${filt.total} 行，未命中 ${filt.miss}`, '减少且 0 未命中',
    before.rows === 0 || (filt.total < before.rows && filt.miss === 0));

  // 键盘弹出：可视高 380
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 380 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(500);
  const kb = await tab.evaluate(() => {
    const inp = document.querySelector('.sess-search input').getBoundingClientRect();
    const list = document.querySelector('.sess-scroll').getBoundingClientRect();
    return { vh: Math.round(window.visualViewport.height), appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      top: Math.round(inp.top), bottom: Math.round(inp.bottom), listBottom: Math.round(list.bottom) };
  });
  // 横屏 844×390 本身只有 390 高，压到 380 差 10px 不算键盘（阈值 120），不做外壳断言
  if (h > 500) {
    check(tag, '键盘弹出外壳跟随可视高', `${kb.appVh}`, '380px', kb.appVh === '380px');
    check(tag, '键盘弹出输入框在可视区内', `框 ${kb.top}-${kb.bottom} 可视底=${kb.vh}`, `bottom≤${kb.vh}`, kb.bottom <= kb.vh + 1);
    check(tag, '键盘弹出列表不越可视底', `列表底=${kb.listBottom}`, `≤${kb.vh}`, kb.listBottom <= kb.vh + 1);
  }
  await tab.evaluate(() => { const vv = window.visualViewport; delete vv.height; vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); });
  await tab.waitForTimeout(400);
  const back = await tab.evaluate(() => ({ appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(), shell: Math.round(document.querySelector('#vrc-shell')?.getBoundingClientRect().height ?? -1) }));
  if (h > 500) check(tag, '收起键盘恢复原高', `${back.appVh} shell=${back.shell}`, `dvh / ${h}`, /dvh/.test(back.appVh) && back.shell === h);
  await tab.close();
}

// 触控降档定档（13 页 @390）：低于 44 的一律走既定三档（顶栏/抽屉 44、chip/表单 36、行内/表格 32）。
// 断言「<36 的控件只允许出现在白名单选择器里」——新增控件若偷偷缩到 32 以下会在这里报出来；
// 同时把「二级导航 40」与「表格行内 ≥32」写成显式口径，避免以后被顺手抹平。
{
  const ALLOW = '[data-tab].ov-tab, .sess-seg button, .sess-row, .sess-self, [data-list-row] button, [data-list-row] a, .gl-inst button, .gl-inst a, [data-subnav-item], tbody td button, tbody td a, .vrc-sidebar .nav-sub .nav-item';
  for (const page of PAGES) {
    const tab = await open(page, 390, 844);
    const r = await tab.evaluate((allowSel) => {
      const below36 = [];
      const below32 = [];
      let navSubMin = null;
      let cellMin = null;
      document.querySelectorAll('button, a[href], [role="button"], input, select').forEach((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || b.width <= 0 || b.height <= 0) return;
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 12);
        const hh = Math.round(b.height);
        if (el.closest('.vrc-sidebar .nav-sub') && hh >= 24) navSubMin = navSubMin == null ? hh : Math.min(navSubMin, hh);
        if (el.closest('tbody td')) cellMin = cellMin == null ? hh : Math.min(cellMin, hh);
        if (hh < 32) below32.push(`${label}=${hh}`);
        if (hh < 36 && !el.matches(allowSel)) below36.push(`${label}=${hh}`);
      });
      return { below36: below36.slice(0, 6), n36: below36.length, below32: below32.slice(0, 6), navSubMin, cellMin };
    }, ALLOW);
    const tag = `residue@${page}@390`;
    check(tag, '<36 控件只在降档白名单内', r.n36 ? r.below36.join(' | ') : '0 个越界', '0', r.n36 === 0);
    check(tag, '无 <32 控件', r.below32.length ? r.below32.join(' | ') : '0 个', '0', r.below32.length === 0);
    if (r.navSubMin != null) check(tag, '抽屉二级导航 40 档', `${r.navSubMin}px`, '40–43px', r.navSubMin >= 40 && r.navSubMin <= 43);
    if (r.cellMin != null) check(tag, '表格行内目标 32 档', `${r.cellMin}px`, '≥32px', r.cellMin >= 32);
    await tab.close();
  }
}

await browser.close();

// 人工对照用快照：按断言组（tag）归组落 docs/mobile-baseline.md，省得翻 900 行日志找「哪个页面哪条口径」。
{
  const { writeFileSync } = await import('node:fs');
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.page)) groups.set(r.page, []);
    groups.get(r.page).push(r);
  }
  const failN = rows.filter((r) => !r.ok).length;
  const out = [
    '# 移动端验收基线（自动生成，勿手改）',
    '',
    `生成：${new Date().toISOString().slice(0, 19).replace('T', ' ')} · 断言 ${rows.length - failN}/${rows.length} PASS · 页面 ${PAGES.length} × 视口 ${WIDTHS.length + 1}`,
    '',
    '移动形态判据：宽 ≤1023 或高 ≤500（styles.css / tailwind md raw / Sidebar matchMedia 三处一致）。',
    '重新生成：`node scripts/mobile_parity.mjs`（脚本末尾自动写回本文件）。',
    '',
  ];
  for (const [tag, list] of groups) {
    out.push(`## ${tag}`, '', '| 断言 | 实测 | 期望 | 结果 |', '| --- | --- | --- | --- |');
    for (const r of list) {
      const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
      out.push(`| ${esc(r.name)} | ${esc(r.ours)} | ${esc(r.want)} | ${r.ok ? 'PASS' : '**FAIL**'} |`);
    }
    out.push('');
  }
  writeFileSync(path.join(process.cwd(), 'docs/mobile-baseline.md'), out.join('\n'));
}

const fail = rows.filter((r) => !r.ok);
const pct = ((rows.length - fail.length) / rows.length * 100).toFixed(1);
console.log(`\n${rows.length - fail.length}/${rows.length} PASS (${pct}%)  页面 ${PAGES.length} × 视口 ${WIDTHS.length + 1}（+抽屉/断点）`);
if (fail.length) {
  console.log('\nFAIL 汇总:');
  for (const f of fail) console.log(`  ${f.page} · ${f.name}: ${f.ours}（期望 ${f.want}）`);
  process.exit(1);
}
console.log('MOBILE OK');