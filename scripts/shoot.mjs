/**
 * 三端截图（桌面 1600 / 手机 390 / 4K 3840）——通过 CDP 驱动 PC 上的 Chrome headless。
 *
 *   ssh -N -R 18899:127.0.0.1:8899 -L 9222:127.0.0.1:9222 pc     # 双隧道
 *   APP=http://127.0.0.1:18899/ node scripts/shoot.mjs             # 产出 docs/screenshots/round7-*.png
 *
 * 需要：容器里跑 server/scripts/demo.mjs（8899），PC 上 Chrome --headless=new --remote-debugging-port=9222。
 * 注意：PC 本机 8899 被别的服务占用（图片墙），转发端口固定用 18899，否则截到的是别人的页面。
 */
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP ?? 'http://127.0.0.1:9222';
const APP = process.env.APP ?? 'http://127.0.0.1:18899/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
if (!res.ok) throw new Error(`CDP 建页失败 HTTP ${res.status}`);
const target = await res.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { r, j } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? j(new Error(`${m.error.message} (${JSON.stringify(m.error.data ?? '')})`)) : r(m.result);
  }
};
const send = (method, params = {}) => new Promise((r, j) => {
  const id = ++seq;
  pending.set(id, { r, j });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evaluate 失败：${r.exceptionDetails.text}`);
  return r.result?.value;
};

/** 等「加载中」消失，最多 ms 毫秒。 */
async function waitLoaded(ms = 15000) {
  for (let t = 0; t < ms; t += 500) {
    if (!(await evalJs(`document.body.innerText.includes('加载中')`))) return true;
    await sleep(500);
  }
  return false;
}

const clickByText = (label) => `(() => {
  const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(label)}));
  if (!b) return 'miss'; b.click(); return 'ok';
})()`;

async function shoot(name, width, height, dpr, mobile, clicks) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await send('Page.navigate', { url: APP });
  await sleep(2500);
  await waitLoaded();
  for (const label of clicks) {
    const out = await evalJs(clickByText(label));
    if (out !== 'ok') throw new Error(`点不到「${label}」（${out}）`);
    await sleep(1500);
    await waitLoaded();
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(OUT, `round7-${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  const info = await evalJs(`JSON.stringify({ title: document.title, w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth > innerWidth, text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120) })`);
  console.log(`${name} ${width}x${height}dpr${dpr} -> ${file} ${info}`);
  return file;
}

await shoot('desktop-overview', 1600, 1000, 1, false, ['概览']);
await shoot('desktop-friends', 1600, 1000, 1, false, ['好友位置']);
await shoot('mobile-overview', 390, 844, 2, true, ['概览']);
await shoot('4k-overview', 3840, 2160, 1, false, ['概览']);

ws.close();
console.log('SHOTS OK');
process.exit(0);
