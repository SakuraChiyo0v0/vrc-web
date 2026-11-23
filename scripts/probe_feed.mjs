/**
 * 动态页（#/feed）几何量测：把我们渲染出来的表格/工具条与 docs/ref/feed-measure.json 同口径比。
 *
 *   node scripts/probe_feed.mjs [baseUrl]      # 默认 http://127.0.0.1:8897
 *
 * 输出 JSON：panel/table 的 x,y,w,h，表头高、首行高、列文字起点与列宽、工具条各控件 rect、可见行数、
 * 是否存在页脚（真机 footer=false）、类型列文案。
 */
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://127.0.0.1:8897').replace(/\/$/, '');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await p.waitForFunction(() => {
  const t = document.querySelector('[data-testid="feed-table"]');
  return t && t.querySelectorAll('tbody tr').length > 0;
}, { timeout: 30000 }).catch(() => {});

const out = await p.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const tab = document.querySelector('[data-testid="feed-table"]');
  const panel = document.querySelector('.workspace') || document.querySelector('main');
  const ths = [...document.querySelectorAll('[data-testid="feed-table"] thead th')];
  const trs = [...document.querySelectorAll('[data-testid="feed-table"] tbody tr')];
  // 列文字起点：用表头文字节点 cell 的 padding 边（真机量测取文字像素起点，这里取 cell 左边界 + padding）
  const cols = ths.map((th) => {
    const b = th.getBoundingClientRect();
    return {
      text: (th.textContent || '').trim(),
      x: Math.round(b.x),
      w: Math.round(b.width),
      pad: getComputedStyle(th).paddingLeft,
    };
  });
  const tb = document.querySelector('[data-testid="feed-toolbar"]');
  const kids = tb ? [...tb.children].map((c) => ({ cls: c.className, tag: c.tagName, rect: r(c), text: (c.textContent || '').trim().slice(0, 20) })) : [];
  const inView = (el) => { const b = el.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0 && b.height > 0; };
  const types = [...new Set(trs.map((tr) => (tr.children[2]?.textContent || '').trim()))].slice(0, 10);
  return {
    panel: r(panel),
    table: r(tab),
    thead: r(tab?.querySelector('thead')),
    firstRow: r(trs[0]),
    toolbar: r(tb),
    toolbarKids: kids,
    cols,
    rowsAll: trs.length,
    rowsVisible: trs.filter(inView).length,
    types,
    footerText: (document.querySelector('.feed-page')?.lastElementChild?.textContent || '').trim().slice(0, 60),
    bodyTail: (document.querySelector('.feed-page')?.innerText || '').trim().split('\n').slice(-3),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
