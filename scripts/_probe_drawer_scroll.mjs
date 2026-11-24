// 探针：抽屉内容超出视口时能否滚到最后一项；以及 320px 最窄档的溢出/字号/触控
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [w, h] of [[390, 844], [844, 390], [768, 1024], [932, 430]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await tab.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1200);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    const cs = getComputedStyle(s);
    const items = [...s.querySelectorAll('.nav-item')].filter((n) => n.getBoundingClientRect().height > 0);
    const last = items[items.length - 1];
    const r0 = s.getBoundingClientRect();
    const before = last ? Math.round(last.getBoundingClientRect().bottom) : null;
    s.scrollTop = s.scrollHeight;
    const after = last ? Math.round(last.getBoundingClientRect().bottom) : null;
    return {
      h: Math.round(r0.height), scrollH: s.scrollHeight, clientH: s.clientHeight,
      oy: cs.overflowY, touched: cs.webkitOverflowScrolling || '-',
      items: items.length, lastBottomBefore: before, lastBottomAfter: after,
      vh: window.innerHeight, scrollTop: Math.round(s.scrollTop), maxScroll: s.scrollHeight - s.clientHeight,
    };
  });
  console.log(`drawer ${w}x${h}`, JSON.stringify(r));
  await tab.close();
}

for (const [w, h] of [[320, 568], [320, 480]]) {
  for (const p of ['friends', 'feed', 'settings', 'worlds', 'stats', 'friendlist', 'overview', 'sessions']) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded' });
    await tab.waitForTimeout(1300);
    const r = await tab.evaluate(() => {
      const de = document.documentElement;
      const off = [];
      document.querySelectorAll('body *').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && b.right > window.innerWidth + 1) {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed') off.push(`${el.tagName}.${(el.className || '').toString().slice(0, 18)} r=${Math.round(b.right)}`);
        }
      });
      let minFont = 99;
      document.querySelectorAll('body *').forEach((el) => {
        if (!el.childNodes.length) return;
        const t = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (!t) return;
        const b = el.getBoundingClientRect();
        if (b.width <= 0 || b.height <= 0) return;
        minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
      });
      return { sw: de.scrollWidth, vw: window.innerWidth, off: off.slice(0, 4), minFont };
    });
    const bad = r.sw > r.vw + 1 || r.off.length || r.minFont < 11;
    console.log(`${w}x${h} ${p}`, bad ? 'BAD' : 'ok', JSON.stringify(r));
    await tab.close();
  }
}
await browser.close();
