// 好友详情弹窗细查：卡片自身是否需滚动、8 个 tab 在窄屏是否被裁、横屏是否压状态栏
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const VPS = [[390, 844], [360, 800], [844, 390], [320, 568]];
const browser = await chromium.launch({ executablePath: EXE });
for (const [w, h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await tab.waitForTimeout(900);
  await tab.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true }).catch(() => {});
  await tab.waitForSelector('.fd-card', { timeout: 8000 }).catch(() => {});
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const card = document.querySelector('.fd-card');
    if (!card) return null;
    const tabs = document.querySelector('.fd-tabs');
    const btns = tabs ? [...tabs.querySelectorAll('button')] : [];
    const tb = tabs ? tabs.getBoundingClientRect() : null;
    const tcs = tabs ? getComputedStyle(tabs) : null;
    const last = btns[btns.length - 1];
    const lastR = last ? last.getBoundingClientRect() : null;
    const sb = document.querySelector('#vrc-statusbar');
    const sbTop = sb ? Math.round(sb.getBoundingClientRect().top) : null;
    const cardR = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    // 卡片内最靠下的可见内容
    let maxBottom = 0;
    [...card.querySelectorAll('*')].forEach((e) => { const b = e.getBoundingClientRect(); if (b.height > 0 && b.width > 0) maxBottom = Math.max(maxBottom, b.bottom); });
    // 试着滚到底
    card.scrollTop = 1e6;
    const afterTop = Math.round(card.scrollTop);
    const panels = [...card.querySelectorAll('.fd-panel h4')].map((x) => x.textContent.trim());
    const lastPanel = [...card.querySelectorAll('.fd-panel')].pop();
    const lpB = lastPanel ? Math.round(lastPanel.getBoundingClientRect().bottom) : null;
    return {
      vw: innerWidth, vh: innerHeight,
      card: { y: Math.round(cardR.y), h: Math.round(cardR.height), b: Math.round(cardR.bottom), ch: card.clientHeight, sh: card.scrollHeight },
      ovf: cs.overflowY, maxH: cs.maxHeight, radius: cs.borderTopLeftRadius,
      tabs: tb ? { w: Math.round(tb.width), right: Math.round(tb.right), ovfX: tcs.overflowX, count: btns.length, lastRight: lastR ? Math.round(lastR.right) : null, lastVis: lastR ? lastR.right <= innerWidth + 1 : null } : null,
      sbTop, cardOverSb: sbTop != null && cardR.bottom > sbTop + 1 ? Math.round(cardR.bottom - sbTop) : 0,
      maxBottom: Math.round(maxBottom), scrolledTo: afterTop, lpB, panels: panels.join('/'),
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
