// 诊断：nav 滚动 & 顶栏 roster-toggle 在窄视口为何仍可见
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://vrc-web-r18:8790/vrc/';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h] of [[1024, 768], [1366, 768], [1700, 1040]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const aside = document.querySelector('aside.vrc-sidebar');
    const nav = aside.querySelector('nav');
    const kinds = [...nav.querySelectorAll('[data-nav-kind]')];
    const last = kinds[kinds.length - 1];
    const nb = nav.getBoundingClientRect();
    nav.scrollTop = 99999;
    const lastR = last.getBoundingClientRect();
    const tb = document.querySelector('#vrc-topbar');
    const tg = document.querySelector('.roster-toggle');
    const cs = nav && getComputedStyle(nav);
    return {
      nav: { clientH: nav.clientHeight, scrollH: nav.scrollHeight, scrollTop: nav.scrollTop, overflowY: cs.overflowY, flex: cs.flex, minHeight: cs.minHeight },
      navRect: { top: Math.round(nb.top), bottom: Math.round(nb.bottom) },
      last: { kind: last.dataset.navKind, bottom: Math.round(lastR.bottom), h: Math.round(lastR.height) },
      kinds: kinds.map(k => k.dataset.navKind).join(','),
      asideH: Math.round(aside.getBoundingClientRect().height),
      topbarChildren: [...tb.children].map(c => c.className.toString().slice(0, 60)),
      toggleInTopbar: tg ? (tb.contains(tg) ? 'yes' : `no, parent=${tg.parentElement.className}`) : 'none',
      toggleDisplay: tg ? getComputedStyle(tg).display : null,
      mq1439: matchMedia('(max-width: 1439px)').matches,
      cssLoaded: [...document.styleSheets].map(s => s.href || 'inline').slice(0, 6)
    };
  });
  console.log(`${w}x${h}`, JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
