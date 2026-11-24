/** 探针：抽屉交互（遮罩/Esc/焦点）、横屏顶栏密度、设置页开关命中区 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const open = async (p, w, h) => {
  const t = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await t.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1200);
  return t;
};

// 1) 抽屉：Esc 关闭 / 焦点是否进抽屉 / 遮罩点击关闭
{
  const t = await open('friends', 390, 844);
  await t.click('button[aria-label="菜单"]');
  await t.waitForTimeout(350);
  const focused = await t.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName, inSidebar: !!a?.closest('.vrc-sidebar'), label: a?.getAttribute('aria-label') || a?.textContent?.trim().slice(0, 12) };
  });
  await t.keyboard.press('Escape');
  await t.waitForTimeout(350);
  const afterEsc = await t.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
  // 遮罩点击（Esc 无效时先用 ✕ 复位）
  const close = async () => {
    const left = await t.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
    if (left >= -1) { await t.click('.vrc-sidebar-close'); await t.waitForTimeout(300); }
  };
  await close();
  await t.click('button[aria-label="菜单"]');
  await t.waitForTimeout(300);
  await t.mouse.click(360, 400);
  await t.waitForTimeout(350);
  const afterOverlay = await t.evaluate(() => Math.round(document.querySelector('.vrc-sidebar')?.getBoundingClientRect().left ?? 0));
  console.log('drawer: focusAfterOpen=', JSON.stringify(focused), 'leftAfterEsc=', afterEsc, 'leftAfterOverlayClick=', afterOverlay);
  await t.close();
}

// 2) 横屏顶栏密度
for (const [w, h] of [[844, 390], [932, 430], [390, 844]]) {
  const t = await open('friends', w, h);
  const r = await t.evaluate(() => {
    const bar = document.querySelector('#vrc-topbar');
    const kids = [...bar.children].filter((e) => e.getBoundingClientRect().width > 0);
    const h1 = bar.querySelector('h1');
    const btns = [...bar.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => { const q = b.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width), h: Math.round(q.height), label: b.getAttribute('aria-label') || b.title || b.textContent.trim().slice(0, 6) }; });
    return {
      barW: Math.round(bar.getBoundingClientRect().width), barH: Math.round(bar.getBoundingClientRect().height),
      kids: kids.map((k) => `${k.tagName.toLowerCase()}:${Math.round(k.getBoundingClientRect().width)}`),
      title: h1 ? { text: h1.textContent, w: Math.round(h1.getBoundingClientRect().width), sw: h1.scrollWidth, trunc: h1.scrollWidth > h1.clientWidth + 1 } : null,
      btns,
    };
  });
  console.log(`topbar@${w}x${h}`, JSON.stringify(r));
  await t.close();
}

// 3) 设置页开关命中区
for (const [w, h] of [[390, 844], [844, 390]]) {
  const t = await open('settings', w, h);
  const r = await t.evaluate(() => {
    const sw = [...document.querySelectorAll('[role="switch"]')].filter((e) => e.getBoundingClientRect().width > 0);
    if (!sw.length) return { n: 0 };
    const el = sw[0];
    const q = el.getBoundingClientRect();
    const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
    const hit = (dy) => { const e = document.elementFromPoint(cx, cy + dy); return e === el || el.contains(e) ? 'switch' : `${e?.tagName.toLowerCase()}.${(e?.className || '').toString().split(' ')[0]}`; };
    return { n: sw.length, w: Math.round(q.width), h: Math.round(q.height),
      up22: hit(-22), up13: hit(-13), dn13: hit(13), dn22: hit(22), left22: (() => { const e = document.elementFromPoint(cx - 22, cy); return e === el || el.contains(e) ? 'switch' : e?.tagName.toLowerCase(); })() };
  });
  console.log(`switch@${w}x${h}`, JSON.stringify(r));
  await t.close();
}
await browser.close();
