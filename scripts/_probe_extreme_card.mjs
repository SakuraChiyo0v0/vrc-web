/**
 * 探针：表格卡片在极端数据下的表现（360 宽）——超长昵称、无头像、空值。
 *   node scripts/_probe_extreme_card.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [page, w, h] of [['friendlist', 360, 800], ['feed', 360, 800], ['friendlist', 390, 844]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1800);
  await tab.waitForFunction(() => !!document.querySelector('tbody tr'), { timeout: 8000 }).catch(() => {});
  const r = await tab.evaluate(() => {
    const tr = document.querySelector('tbody tr');
    if (!tr) return { err: 'no row' };
    const clone = tr.cloneNode(true);
    clone.setAttribute('data-probe', 'extreme');
    const tds = [...clone.querySelectorAll('td')];
    // 1) 超长昵称（80 个中文字 / 120 字符混合）
    if (tds[1]) tds[1].textContent = '超长昵称'.repeat(20);
    // 2) 无头像：删掉 img/svg，让单元格只有占位文字
    const av = clone.querySelector('img, svg');
    if (av) av.remove();
    // 3) 空值：最后一格清空
    if (tds[tds.length - 1]) tds[tds.length - 1].textContent = '';
    tr.parentElement.insertBefore(clone, tr.nextSibling);
    const vw = document.documentElement.clientWidth;
    const all = [document.documentElement.scrollWidth, ...[...document.querySelectorAll('body *')].filter((e) => {
      const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return b.width > 0 && b.right > vw + 1 && cs.position !== 'fixed';
    }).map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`).slice(0, 5)];
    const cells = [...clone.querySelectorAll('td')].map((td) => {
      const b = td.getBoundingClientRect();
      return { l: td.dataset.label, w: Math.round(b.width), right: Math.round(b.right), sw: td.scrollWidth, cw: td.clientWidth };
    });
    const nameTd = tds[1];
    const nameLines = nameTd ? Math.round(nameTd.getBoundingClientRect().height / parseFloat(getComputedStyle(nameTd).lineHeight || 14)) : null;
    return {
      docW: document.documentElement.scrollWidth, vw, over: all, cells,
      trDisplay: getComputedStyle(clone).display,
      nameText: nameTd ? `${Math.round(nameTd.getBoundingClientRect().height)}px 高≈${nameLines} 行 sw=${nameTd.scrollWidth} cw=${nameTd.clientWidth}` : null,
      vOver: clone.scrollWidth > clone.clientWidth,
      wrap: nameTd ? getComputedStyle(nameTd.querySelector('*') || nameTd).overflowWrap + '/' + getComputedStyle(nameTd.querySelector('*') || nameTd).wordBreak : null,
    };
  });
  console.log(`${page}@${w}x${h}`, JSON.stringify(r, null, 1));
  await tab.close();
}
await browser.close();
