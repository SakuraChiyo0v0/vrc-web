/**
 * 探针：软键盘弹出（iOS visualViewport 缩小）时外壳/状态栏/聚焦输入框的几何。
 *
 * Chromium 没有真键盘，用 defineProperty 把 visualViewport.height 改成 380（≈iPhone 竖屏
 * 键盘占掉下方 464px）并派发 resize，模拟 iOS 的行为：layout viewport 不变、visual viewport 变小。
 *
 *   node scripts/_probe_keyboard.mjs [baseUrl]
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

async function run(page, width, height, kb) {
  const tab = await browser.newPage({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1600);
  await tab.waitForFunction(() => {
    const th = document.querySelector('thead');
    return !th || !!document.querySelector('tbody tr');
  }, { timeout: 8000 }).catch(() => {});

  const before = await tab.evaluate(() => {
    const shell = document.querySelector('#root > div');
    const sb = document.querySelector('#vrc-statusbar');
    return { root: document.getElementById('root').getBoundingClientRect().height, shell: shell?.getBoundingClientRect().height, sbBottom: sb ? Math.round(sb.getBoundingClientRect().bottom) : null };
  });

  // 聚焦搜索框：真机此时键盘弹出
  const SEL = { feed: '[data-testid="feed-search"]', sessions: 'input[placeholder="搜索房间"]', friends: 'input[placeholder*="搜索"]' };
  const input = tab.locator(SEL[page] || 'input[placeholder*="搜索"]').first();
  await input.click({ timeout: 5000 }).catch(() => {});
  await tab.waitForTimeout(200);
  const focused0 = await tab.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('placeholder') || ''));

  await tab.evaluate((kbH) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => kbH });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, kb);
  await tab.waitForTimeout(600);

  const after = await tab.evaluate(() => {
    const shell = document.querySelector('#root > div');
    const sb = document.querySelector('#vrc-statusbar');
    const inp = document.activeElement;
    const r = inp?.getBoundingClientRect?.();
    return {
      vvH: window.visualViewport.height,
      appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      root: Math.round(document.getElementById('root').getBoundingClientRect().height),
      shell: shell ? Math.round(shell.getBoundingClientRect().height) : null,
      sbBottom: sb ? Math.round(sb.getBoundingClientRect().bottom) : null,
      focus: inp ? `${inp.tagName.toLowerCase()}[${inp.getAttribute('placeholder') || inp.type}]` : null,
      focusTop: r ? Math.round(r.top) : null,
      focusBottom: r ? Math.round(r.bottom) : null
    };
  });
  // 键盘收起
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    delete vv.height; // 还原原型 getter
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(400);
  const restored = await tab.evaluate(() => Math.round(document.getElementById('root').getBoundingClientRect().height));
  console.log(`${page}@${width}x${height} kb=${kb}`, JSON.stringify({ focused0, before, after, restored }, null, 0));
  await tab.close();
}

for (const [w, h] of [[390, 844], [360, 800]]) {
  await run('feed', w, h, 380);
  await run('friends', w, h, 380);
  await run('sessions', w, h, 380);
}
await run('feed', 1440, 900, 600); // 桌面：缩极小也不该改外壳（桌面形态不走 --app-vh 外壳）

await browser.close();
