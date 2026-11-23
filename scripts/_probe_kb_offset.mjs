/**
 * 探针：iOS 键盘的两件真机行为，Chromium 只能靠覆写 visualViewport 模拟。
 *   A) 可视区上卷：offsetTop>0（聚焦靠下的输入框时 Safari 把可视区整体上卷，layout viewport 不动）
 *   B) 横屏 + 键盘：844×390 时键盘占 ~220，只剩 170 可视高
 *
 *   node scripts/_probe_kb_offset.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8891');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const geo = (tab) => tab.evaluate(() => {
  const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const vv = window.visualViewport;
  return {
    vvH: Math.round(vv.height), vvTop: Math.round(vv.offsetTop || 0),
    appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
    kbFlag: document.documentElement.dataset.kb || null,
    shell: r('#vrc-shell'), topbar: r('#vrc-topbar'), sb: r('#vrc-statusbar'),
    main: r('main'), docH: Math.round(document.getElementById('root').getBoundingClientRect().height),
  };
});

const sim = (tab, h, top) => tab.evaluate(([H, T]) => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, 'height', { configurable: true, get: () => H });
  Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => T });
  vv.dispatchEvent(new Event('resize'));
  vv.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
}, [h, top]);

async function open(w, h, page = 'feed') {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2, isMobile: true });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1500);
  await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
  return tab;
}

// A) 竖屏：键盘 380 + 可视区上卷 120
{
  const tab = await open(390, 844);
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.waitForTimeout(150);
  await sim(tab, 380, 120);
  await tab.waitForTimeout(500);
  console.log('A 390x844 kb380 top120', JSON.stringify(await geo(tab)));
  // 有表格行时下滚到靠下行再聚焦，看 offsetTop 变大后的顶栏
  await sim(tab, 380, 400);
  await tab.waitForTimeout(400);
  console.log('A2 390x844 kb380 top400', JSON.stringify(await geo(tab)));
  await tab.close();
}

// B) 横屏 + 键盘：844×390，键盘 220 → 可视 170
for (const [w, h, kb] of [[844, 390, 220], [932, 430, 240]]) {
  const tab = await open(w, h);
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.waitForTimeout(150);
  await sim(tab, h - kb, 0);
  await tab.waitForTimeout(500);
  const g = await geo(tab);
  // 抽屉在极矮可视区里是否还能滚到最后一项
  await tab.evaluate(() => document.querySelector('[aria-label="菜单"]')?.click());
  await tab.waitForTimeout(300);
  const d = await tab.evaluate(() => {
    const bar = document.querySelector('.vrc-sidebar');
    if (!bar) return null;
    const items = [...bar.querySelectorAll('.nav-item')];
    bar.scrollTop = bar.scrollHeight;
    const last = items[items.length - 1];
    const b = bar.getBoundingClientRect();
    const lb = last?.getBoundingClientRect();
    return { n: items.length, client: bar.clientHeight, scroll: bar.scrollHeight, top: Math.round(b.top), bottom: Math.round(b.bottom), lastBottom: lb ? Math.round(lb.bottom) : null };
  });
  console.log(`B ${w}x${h} kb${kb}`, JSON.stringify({ g, drawer: d }));
  await tab.close();
}

await browser.close();
