/**
 * 移动端断点回归：把「移动端长什么样」变成可量的数字，而不是看图说话。
 *
 *   node scripts/mobile_parity.mjs [baseUrl] [--all]
 *
 * 覆盖 STRUCT_PAGES + friends（14 页）× 7 个移动视口（360/375/390/414/430 竖屏 + 844×390/932×430 横屏），
 * 外加 767 / 768 与 900×500 / 900×501 两对「断点两侧」检查（窄/矮 → 移动形态，否则桌面形态）。
 *
 * 每页断言：
 *   1) 无横向溢出：documentElement.scrollWidth ≤ innerWidth+1，且列出右溢元素
 *   2) 表格卡片化（≤767）：thead display:none、tbody tr display:flex/flex-direction:column
 *      ≥768：thead 可见、tbody tr 不是 flex 卡片
 *   3) 触控目标：所有可见 button/a/[role=button] 高度 ≥ 28（报告最小值与违规清单）
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
// 横屏宽 >767，命中的是「矮视口」那一支移动规则（styles.css: max-width:767px, max-height:500px）。
const WIDTHS = [[360, 800], [375, 667], [390, 844], [414, 896], [430, 932], [844, 390], [932, 430]];

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
    tapSmall: tap.filter((x) => x.h < 28).slice(0, 6),
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
    check(tag, '触控目标≥28', a.tapMin == null ? 'n/a' : `${a.tapMin}px`, '≥28px', a.tapMin == null || a.tapMin >= 28);
    if (a.tapSmall.length) console.log(`      过小触控: ${a.tapSmall.map((t) => `${t.t}(${t.h}px)`).join(' ')}`);
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

// 断点两侧：767 移动形态 / 768 桌面形态（只测一页，形态判定同页）
// 表格可能还没渲染出来（feed 首屏要等接口），先等 thead / tbody tr 出现；仍无则退到 friendlist 重开一次。
async function openWithTable(p, width, height) {
  let tab = await open(p, width, height);
  await tab.waitForFunction(() => !!document.querySelector('thead'), { timeout: 8000 }).catch(() => {});
  let has = await tab.evaluate(() => !!document.querySelector('thead'));
  if (!has) { await tab.close(); tab = await open('friendlist', width, height);
    await tab.waitForFunction(() => !!document.querySelector('thead'), { timeout: 8000 }).catch(() => {}); }
  return tab;
}

for (const [w, h, mobile] of [[767, 900, true], [768, 900, false], [900, 500, true], [900, 501, false]]) {
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

// 安全区：把 env() 变量按刘海机/带指示条真机的值注入，量顶栏是否加高、抽屉是否让位
for (const [w, h, top, bottom] of [[390, 844, 47, 34], [844, 390, 0, 21]]) {
  const tab = await open('friends', w, h);
  await tab.waitForTimeout(500);
  const base = await tab.evaluate(() => ({
    bar: Math.round(document.querySelector('.vrc-topbar').getBoundingClientRect().height),
    vars: ['--safe-top', '--safe-bottom'].map((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim()),
  }));
  const r = await tab.evaluate(([t, b]) => {
    document.documentElement.style.setProperty('--safe-top', `${t}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${b}px`);
    const bar = document.querySelector('.vrc-topbar');
    const sd = document.querySelector('.vrc-sidebar');
    return {
      barH: Math.round(bar.getBoundingClientRect().height),
      barPad: parseFloat(getComputedStyle(bar).paddingTop),
      sdPadTop: parseFloat(getComputedStyle(sd).paddingTop),
      sdPadBottom: parseFloat(getComputedStyle(sd).paddingBottom),
    };
  }, [top, bottom]);
  check(`safe-area@${w}x${h}`, '安全区变量已定义', base.vars.join('/'), '全是长度值（0px 起）', base.vars.every((v) => /px$/.test(v)));
  check(`safe-area@${w}x${h}`, '顶栏让出刘海', `bar=${r.barH} pad=${r.barPad}（原 ${base.bar}）`, `≤39+${top} 且 pad=${top}`,
    r.barPad === top && r.barH >= 39 + top - 0.5 && r.barH <= 39 + top + 0.5);
  check(`safe-area@${w}x${h}`, '抽屉上下让位', `top=${r.sdPadTop} bottom=${r.sdPadBottom}`, `top=${top} bottom=${bottom}`,
    r.sdPadTop === top && r.sdPadBottom === bottom);
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