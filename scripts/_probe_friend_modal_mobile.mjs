// 好友详情弹窗（.fd-card）在移动视口下的可用性体检：宽高是否超出视口、内容可滚、关闭可达、字号
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const VPS = [[390, 844], [360, 800], [430, 932], [844, 390], [320, 568]];
const browser = await chromium.launch({ executablePath: EXE });
for (const [w, h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await tab.waitForTimeout(900);
  await tab.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true }).catch(() => {});
  const ok = await tab.waitForSelector('.fd-card', { timeout: 8000 }).then(() => true).catch(() => false);
  if (!ok) { console.log(`${w}x${h}  弹窗未打开`); await ctx.close(); continue; }
  await tab.waitForTimeout(500);
  const r = await tab.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
    const card = q('.fd-card');
    const cs = card ? getComputedStyle(card) : null;
    const vw = window.innerWidth, vh = window.innerHeight;
    // 卡片内是否有可滚容器，滚到底能否看到最后一个面板
    const cands = [...(card ? card.querySelectorAll('*') : [])].filter((e) => {
      const s = getComputedStyle(e);
      return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2;
    }).map((e) => ({ cls: (e.className || '').toString().split(' ')[0], ch: e.clientHeight, sh: e.scrollHeight }));
    // 关闭按钮
    const close = card ? [...card.querySelectorAll('button')].find((b) => /✕|×|关闭/.test(b.textContent || '') || b.dataset.close != null) : null;
    let closeHit = null; if (close) { const b = close.getBoundingClientRect(); closeHit = document.elementFromPoint(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)); closeHit = closeHit ? (closeHit === close || close.contains(closeHit)) : false; }
    // 右溢/越界
    const off = [];
    if (card) [...card.querySelectorAll('*')].forEach((e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); if (b.width > 0 && b.height > 0 && b.right > vw + 1 && !/(auto|scroll)/.test(s.overflowX)) off.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`); });
    // 最小字号
    let minFont = 99;
    if (card) [...card.querySelectorAll('*')].forEach((e) => { const s = getComputedStyle(e); if (s.display === 'none' || !e.textContent.trim() || e.children.length) return; minFont = Math.min(minFont, parseFloat(s.fontSize)); });
    // 关闭后滚到底：内容是否有遮挡（状态栏）
    return { vw, vh, card: rect('.fd-card'), overflowY: cs ? cs.overflowY : null, maxH: cs ? cs.maxHeight : null,
      docW: document.documentElement.scrollWidth, off: [...new Set(off)].slice(0, 5), minFont: Math.round(minFont * 10) / 10,
      scrollables: cands.slice(0, 5), closeHit, hasClose: !!close, tabs: [...document.querySelectorAll('.fd-tabs button')].length,
      leftW: (rect('.fd-left') || {}).w ?? null, bodyH: card ? Math.round(card.getBoundingClientRect().height) : null };
  });
  console.log(`${String(w + 'x' + h).padEnd(9)} card=${JSON.stringify(r.card)} maxH=${r.maxH} ovfY=${r.overflowY} docW=${r.docW} left=${r.leftW} tabs=${r.tabs} close=${r.hasClose}/${r.closeHit} f=${r.minFont}`);
  console.log(`          scrollables=${JSON.stringify(r.scrollables)} off=${r.off.join(',') || '-'}`);
  await ctx.close();
}
await browser.close();
