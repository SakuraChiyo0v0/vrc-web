/**
 * 移动端断点回归：把「移动端长什么样」变成可量的数字，而不是看图说话。
 *
 *   node scripts/mobile_parity.mjs [baseUrl] [--all]
 *
 * 覆盖 STRUCT_PAGES + friends（14 页）× 3 个移动宽度（360 / 390 / 430），外加
 * 767 / 768 一对「断点两侧」检查（767 必须是移动形态，768 必须回到桌面形态）。
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
const WIDTHS = [[360, 800], [390, 844], [430, 932]];

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
    await tab.close();
  }
}

// 断点两侧：767 移动形态 / 768 桌面形态（只测一页，形态判定同页）
for (const [w, mobile] of [[767, true], [768, false]]) {
  const tab = await open('feed', w, 900);
  const a = await audit(tab);
  check(`breakpoint@${w}`, '断点形态', `thead=${a.theadDisplay} tr=${a.trDisplay}`, mobile ? 'thead=none tr=flex' : 'thead=table-row 不是 flex',
    mobile ? (a.theadDisplay === 'none' && a.trDisplay === 'flex') : (a.theadDisplay !== 'none' && a.trDisplay !== 'flex'));
  check(`breakpoint@${w}`, '无横向溢出', `scrollW=${a.docScrollW} vw=${a.vw}`, '≤vw+1', a.docScrollW <= a.vw + 1);
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
