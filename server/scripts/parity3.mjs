/**
 * 第三轮功能对齐检查：docs/vrcx0-parity.md 第三轮 31~36，一项一条断言。
 *   node server/scripts/parity3.mjs       # 临时 SQLite 库 + 本地图片桩，退出码 0 为全绿
 *
 * 图片代理不依赖外网：起一个 127.0.0.1 的桩服务吐 PNG，用 VRC_IMG_EXTRA_HOSTS 临时放行，
 * 缓存目录也用临时目录（VRC_IMG_CACHE），跑完删掉，不碰线上。
 * 带 w 后缀的是 web 端接线检查（读源码 / 读构建产物）。
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const file = path.join(os.tmpdir(), `vrc-parity3-${Date.now()}.db`);
const url = `sqlite:${file}`;
const imgCache = fs.mkdtempSync(path.join(os.tmpdir(), 'vrc-parity3-img-'));

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;

// —— 图片桩：一个能数请求次数的 1x1 PNG ——
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
let stubHits = 0;
const stubPort = await freePort();
const stub = http.createServer((req, res) => {
  stubHits += 1;
  if (req.url?.startsWith('/redirect')) {
    res.writeHead(302, { location: `http://127.0.0.1:${stubPort}/avatar.png` });
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'image/png', 'content-length': PNG.length });
  res.end(PNG);
});
await new Promise((r) => stub.listen(stubPort, '127.0.0.1', r));

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...process.env,
    VRC_DB_URL: url,
    PORT: String(port),
    VRC_INGEST_TOKEN: 'parity3-token',
    VRC_IMG_CACHE: imgCache,
    VRC_IMG_EXTRA_HOSTS: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { log += `[spawn error] ${e.message}\n`; exited = `spawn ${e.message}`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p) => {
  const r = await fetch(base + p);
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString('utf8')); } catch {}
  return { status: r.status, json, buf, headers: r.headers };
};

const results = [];
async function check(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: detail ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const dist = (rel) => src(path.join('web/dist', rel));
/** 构建产物里找 assets/index-*.js / *.css */
const asset = (ext) => {
  const dir = path.join(ROOT, 'web/dist/assets');
  must(fs.existsSync(dir), 'web/dist 不存在（先跑 npm run build）');
  const f = fs.readdirSync(dir).find((x) => x.endsWith(ext));
  must(f, `web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(dir, f), 'utf8');
};

let exitCode = 1;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try {
      if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; }
    } catch {}
    await wait(200);
  }
  must(ready, `服务未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);

  // —— 样例数据 ——
  const db = await openDb(url);
  const ins = (sql, p) => db.query(sql, p);
  const at = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
  await ins(`insert into world (id, name, author_id, author_name, capacity, thumbnail) values (?,?,?,?,?,?)`,
    ['wrld_1', 'Test World', 'usr_creator', 'Creator', 32, `http://127.0.0.1:${stubPort}/world.png`]);
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name, icon_url, status) values (?,?,?,?,?,?,?)`,
    ['usr_alice', 'Alice', 'wrld_1:12345~region(jp)', 'wrld_1', 'Test World', `http://127.0.0.1:${stubPort}/avatar.png`, 'active']);
  for (const [kind, min] of [['online', 40], ['location', 20]]) {
    await ins(`insert into friend_event (user_id, display_name, kind, world_id, world_name, at) values (?,?,?,?,?,?)`,
      ['usr_alice', 'Alice', kind, 'wrld_1', 'Test World', at(min)]);
  }
  await ins(`update collector_state set connected = 1, last_msg_at = ?, msg_count = 42, last_error = null where id = 1`,
    [at(1)]);
  await db.close();

  // —— 31 图片代理 + 落盘缓存 + SSRF 拦截 ——
  await check(31, '图片代理 /api/img', async () => {
    const u = `http://127.0.0.1:${stubPort}/avatar.png`;
    const first = await get(`/api/img?u=${encodeURIComponent(u)}`);
    must(first.status === 200, `首次 HTTP ${first.status} ${first.buf.toString('utf8').slice(0, 120)}`);
    must(/^image\//.test(first.headers.get('content-type') ?? ''), `content-type ${first.headers.get('content-type')}`);
    must(first.headers.get('x-img-cache') === 'miss', `首次应为 miss，实际 ${first.headers.get('x-img-cache')}`);
    must(first.buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), '返回体不是 PNG');
    const second = await get(`/api/img?u=${encodeURIComponent(u)}`);
    must(second.status === 200, `二次 HTTP ${second.status}`);
    must(second.headers.get('x-img-cache') === 'hit', `二次应为 hit，实际 ${second.headers.get('x-img-cache')}`);
    must(second.buf.equals(first.buf), '缓存命中但字节不一致');
    must(stubHits === 1, `二次请求打到了上游（桩命中 ${stubHits} 次，应为 1）`);
    const cached = fs.readdirSync(imgCache).filter((f) => f.endsWith('.bin')).length;
    must(cached === 1, `缓存目录 bin 文件 ${cached} 个，应为 1`);
    // 302 逐跳校验：桩的 /redirect 会跳回白名单内地址 → 200
    const hop = await get(`/api/img?u=${encodeURIComponent(`http://127.0.0.1:${stubPort}/redirect`)}`);
    must(hop.status === 200, `白名单内重定向应 200，实际 ${hop.status}`);
    // SSRF
    for (const bad of ['http://localhost/x.png', 'https://evil.com/x.png', 'http://a.vrchat.cloud/x.png', 'file:///etc/passwd']) {
      const r = await get(`/api/img?u=${encodeURIComponent(bad)}`);
      must(r.status === 403, `${bad} 应 403，实际 ${r.status}`);
    }
    const empty = await get('/api/img?u=');
    must(empty.status === 400, `缺参应 400，实际 ${empty.status}`);
    return `miss→hit 字节一致，上游只打 1 次，缓存 1 个 bin；localhost/evil.com/非 https/file 全 403，空参 400；白名单内 302 正常跟随`;
  });

  // —— 32 头像/缩略图接线（源码 + 构建产物） ——
  await check('32w', '图片代理接线', async () => {
    must(/export function imgUrl/.test(src('web/src/api.js')), 'api.js 没有 imgUrl()');
    for (const f of ['web/src/pages/FriendsPage.jsx', 'web/src/components/FriendDrawer.jsx', 'web/src/components/WorldDrawer.jsx']) {
      const s = src(f);
      must(/import \{[^}]*imgUrl/.test(s), `${f} 没 import imgUrl`);
      must(/imgUrl\(/.test(s), `${f} 没用 imgUrl()`);
      must(!/src=\{f\.icon_url\}|src=\{p\?\.icon_url\}|src=\{data\.world\.thumbnail\}/.test(s), `${f} 还有直连 CDN 的 <img src>`);
    }
    const js = asset('.js');
    must(/api\/img\?u=/.test(js), '构建产物里没有 api/img?u=');
    must(!/src:\s*f\.icon_url/.test(js), '构建产物里仍有直连 icon_url');
    return '好友页/好友抽屉/世界抽屉全部走 imgUrl()，构建产物含 api/img?u= 且无直连 icon_url';
  });

  // —— 33 移动端适配（源码 + 构建 CSS） ——
  await check('33w', '移动端抽屉+卡片', async () => {
    const css = src('web/src/styles.css');
    must(/@media \(max-width: 767px\)/.test(css), 'styles.css 没有 <768px 媒体查询');
    must(/\.vrc-sidebar[\s\S]{0,400}translateX\(-100%\)/.test(css), '侧栏没有默认移出屏幕');
    must(/\.vrc-sidebar\[data-open='true'\]/.test(css), '侧栏没有抽屉打开态');
    must(/\.tbl thead \{ display: none/.test(css), '表格没有在移动端隐藏表头');
    must(/\.tbl[^{]*\{[\s\S]{0,200}display: block/.test(css), '表格行没有转成块（卡片）');
    const app = src('web/src/App.jsx');
    must(/md:hidden/.test(app) && /setNav\(true\)/.test(app), 'App 页头没有移动端汉堡按钮');
    const side = src('web/src/components/Sidebar.jsx');
    must(/data-open=\{open/.test(side), 'Sidebar 没有接 data-open');
    must(/onClose/.test(side), 'Sidebar 没有关闭按钮回调');
    const builtCss = asset('.css');
    must(/max-width:767px/.test(builtCss), '构建产物 CSS 里没有 767px 断点');
    must(/vrc-sidebar/.test(builtCss), '构建产物 CSS 里没有 vrc-sidebar');
    return '源码+构建 CSS 均含 767px 断点、侧栏抽屉、表格转卡片，App 有 md:hidden 汉堡';
  });

  // —— 34 深色主题持久化（首屏内联脚本 + 写回 + 构建产物） ——
  await check('34w', '主题持久化', async () => {
    const html = src('web/index.html');
    must(/localStorage\.getItem\('vrc-theme'\)/.test(html), 'index.html 没有首屏读主题');
    must(/dataset\.theme/.test(html), 'index.html 没有首屏设 data-theme');
    const app = src('web/src/App.jsx');
    must(/localStorage\.setItem\('vrc-theme'/.test(app), 'App 没有写回 localStorage');
    must(/localStorage\.getItem\('vrc-theme'\)/.test(app), 'App 初始态没读 localStorage');
    must(/\[data-theme='dark'\]/.test(src('web/src/styles.css')), 'styles.css 没有 dark token 覆盖');
    must(/vrc-theme/.test(dist('index.html')), '构建后的 index.html 丢了主题首屏脚本');
    const builtCss = asset('.css');
    must(/\[data-theme="?dark"?\]/.test(builtCss), '构建产物 CSS 没有 dark 主题');
    return '首屏内联脚本 + App 读写 localStorage + dark token 均在源码与构建产物里';
  });

  // —— 35 世界链接复制（接口 + 抽屉） ——
  await check(35, '世界/实例链接', async () => {
    const r = await get('/api/world/wrld_1');
    must(r.status === 200, `HTTP ${r.status}`);
    must(typeof r.json.instance === 'string' && r.json.instance === '12345~region(jp)',
      `instance 应为在线好友的实例号，实际 ${JSON.stringify(r.json.instance)}`);
    const empty = await get('/api/world/wrld_nope');
    must(empty.status === 404, `未收录世界应 404，实际 ${empty.status}`);
    const d = src('web/src/components/WorldDrawer.jsx');
    must(/vrchat\.com\/home\/world\/\$\{id\}|vrchat\.com\/home\/world\//.test(d), '抽屉没有世界主页链接');
    must(/home\/launch\?worldId=/.test(d), '抽屉没有实例启动链接');
    must(/navigator\.clipboard/.test(d) && /execCommand\('copy'\)/.test(d), '复制没有 clipboard + 兜底');
    return 'instance=12345~region(jp)，抽屉有主页/实例两个复制按钮，clipboard 带 execCommand 兜底';
  });

  // —— 36 采集健康面板（接口 + 设置页） ——
  await check(36, '采集诊断 /api/diagnostics', async () => {
    const r = await get('/api/diagnostics');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.collector?.connected === true, `connected 应为 true，实际 ${r.json.collector?.connected}`);
    must(Number(r.json.collector.msgCount) === 42, `msgCount ${r.json.collector.msgCount} != 42`);
    must(typeof r.json.collector.lastError !== 'undefined', '缺 lastError 字段');
    must(typeof r.json.rate24h?.events === 'number' && r.json.rate24h.events >= 2,
      `rate24h.events ${r.json.rate24h?.events} < 2`);
    must(typeof r.json.rate24h.perHour === 'number', '缺 perHour');
    must(Number(r.json.friendsTracked) === 1 && Number(r.json.worldsTracked) === 1,
      `好友/世界计数 ${r.json.friendsTracked}/${r.json.worldsTracked} != 1/1`);
    return `connected=true msgCount=42 events24h=${r.json.rate24h.events} perHour=${r.json.rate24h.perHour} lastError=null friends=1 worlds=1`;
  });

  // —— 36w 设置页接线（源码 + 构建产物） ——
  await check('36w', '设置页采集面板', async () => {
    const s = src('web/src/pages/SettingsPage.jsx');
    must(/api\('diagnostics'\)/.test(s), '设置页没调 /api/diagnostics');
    must(/rate24h|rate\?\./.test(s) && /lastError/.test(s), '设置页没展示速率/最近错误');
    must(/refetchInterval/.test(s), '设置页没有轮询刷新');
    const app = src('web/src/App.jsx');
    must(/settings: SettingsPage/.test(app), 'App 没注册设置页');
    must(/settings: \['设置'/.test(app), '设置页没有标题');
    must(/id: 'settings'/.test(src('web/src/components/Sidebar.jsx')), '侧栏没有设置入口');
    const js = asset('.js');
    must(/api\/diagnostics|"diagnostics"/.test(js), '构建产物里没有 diagnostics 调用');
    return '设置页读 /api/diagnostics 展示速率/最近错误，侧栏有入口，已进构建产物';
  });

  const hashed = crypto.createHash('sha256').update(String(stubHits)).digest('hex').slice(0, 8);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  #${String(r.id).padStart(3)}  ${r.name.padEnd(18)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length
    ? `\nPARITY3 FAIL ${failed.length}/${results.length}: #${failed.map((f) => f.id).join(' #')}`
    : `\nPARITY3 OK ${results.length}/${results.length}  (上游请求 ${stubHits} 次 / ${hashed})`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('PARITY3 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  stub.close();
  try { fs.rmSync(file); } catch {}
  try { fs.rmSync(imgCache, { recursive: true, force: true }); } catch {}
  process.exit(exitCode);
}
