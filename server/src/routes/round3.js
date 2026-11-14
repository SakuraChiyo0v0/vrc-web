/**
 * 第三轮：图片代理 + 采集诊断。
 *
 * 图片代理存在的理由：VRChat 的头像/缩略图在 api.vrchat.cloud 上要带登录 cookie，
 * 而且返回的是 302 到 files.vrchat.cloud 的签名 URL（会过期）；浏览器直接引用
 * 既拿不到图也会被防盗链挡。这里服务端带 cookie 取一次、落盘缓存、按原图直出。
 *
 * 防 SSRF：只允许 https + *.vrchat.cloud，重定向逐跳校验（fetch 用 manual，
 * 不让它自己跟到随便哪个内网地址）。测试用的额外 host 只能由 VRC_IMG_EXTRA_HOSTS
 * 显式打开，默认空。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const VRCHAT_HOST = /^([a-z0-9-]+\.)*vrchat\.cloud$/i;
const UA = 'vrc-web/0.1 (self-hosted)';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_HOPS = 3;

function extraHosts() {
  return String(process.env.VRC_IMG_EXTRA_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function allowed(u, extra) {
  if (!u) return false;
  let p;
  try { p = new URL(u); } catch { return false; }
  const host = p.hostname.toLowerCase();
  if (extra.includes(host)) return p.protocol === 'http:' || p.protocol === 'https:';
  return p.protocol === 'https:' && VRCHAT_HOST.test(host);
}

/** 只有 api.vrchat.cloud 需要登录 cookie；签名 CDN 不要带，免得把登录态漏出去 */
function cookieFor(host) {
  if (host !== 'api.vrchat.cloud') return null;
  try {
    const f = process.env.VRC_SESSION_FILE || '/opt/astra/home/vr-session.json';
    return JSON.parse(fs.readFileSync(f, 'utf8')).cookie ?? null;
  } catch {
    return null;
  }
}

export function registerRound3Routes(app, { db, T, iso }) {
  const cacheDir = process.env.VRC_IMG_CACHE || '/opt/data/state/vrc-web/img-cache';
  fs.mkdirSync(cacheDir, { recursive: true });
  const extra = extraHosts();

  const keyOf = (u) => crypto.createHash('sha256').update(u).digest('hex');
  const binPath = (k) => path.join(cacheDir, `${k}.bin`);
  const metaPath = (k) => path.join(cacheDir, `${k}.json`);

  async function readCache(key) {
    try {
      const meta = JSON.parse(await fsp.readFile(metaPath(key), 'utf8'));
      const buf = await fsp.readFile(binPath(key));
      return { buf, ...meta };
    } catch {
      return null;
    }
  }

  async function writeCache(key, url, ct, buf) {
    const tmp = `${binPath(key)}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, binPath(key));
    await fsp.writeFile(metaPath(key), JSON.stringify({ url, ct, at: new Date().toISOString(), bytes: buf.length }));
  }

  /** 逐跳跟重定向：每一跳都过 allowlist，最多 MAX_HOPS 跳 */
  async function fetchImage(url) {
    let current = url;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const u = new URL(current);
      const headers = { 'user-agent': UA, accept: 'image/*' };
      const cookie = cookieFor(u.hostname.toLowerCase());
      if (cookie) headers.cookie = cookie;
      const r = await fetch(current, { headers, redirect: 'manual' });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        const next = loc ? new URL(loc, current).href : null;
        if (!next) throw new Error('重定向没有 location');
        if (!allowed(next, extra)) throw new Error(`重定向到非白名单域名：${new URL(next).hostname}`);
        current = next;
        continue;
      }
      if (!r.ok) throw new Error(`上游 ${r.status}`);
      const ct = r.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) throw new Error(`上游不是图片：${ct || '无 content-type'}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`图片太大：${buf.length}`);
      return { ct, buf };
    }
    throw new Error('重定向次数过多');
  }

  /** 31 图片代理：/api/img?u=<vrchat 图片地址>，落盘缓存，二次请求直接命中 */
  app.get('/api/img', async (req, reply) => {
    const raw = String(req.query.u ?? '').trim();
    if (!raw) return reply.code(400).send({ ok: false, error: '缺 u 参数' });
    if (!allowed(raw, extra)) {
      return reply.code(403).send({ ok: false, error: '只允许 vrchat.cloud 的图片地址' });
    }
    const key = keyOf(raw);
    const hit = await readCache(key);
    if (hit) {
      return reply
        .header('content-type', hit.ct)
        .header('x-img-cache', 'hit')
        .header('cache-control', 'public, max-age=86400')
        .send(hit.buf);
    }
    try {
      const { ct, buf } = await fetchImage(raw);
      await writeCache(key, raw, ct, buf);
      return reply
        .header('content-type', ct)
        .header('x-img-cache', 'miss')
        .header('cache-control', 'public, max-age=86400')
        .send(buf);
    } catch (e) {
      // 上游挂了不返回 5xx 给浏览器刷屏，直接 502 + 明确原因，前端 <img> 自己降级
      return reply.code(502).send({ ok: false, error: e.message });
    }
  });

  /** 36 采集健康：状态 / 24h 事件速率 / 最近错误 */
  app.get('/api/diagnostics', async () => {
    const [s] = await db.query(
      `select connected, last_msg_at, msg_count, last_error from ${T('collector_state')} where id = 1`,
    ).catch(() => [null]);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const q = async (sql, p) => {
      try { return await db.query(sql, p); } catch { return []; }
    };
    const [ev] = await q(`select count(*) as n from ${T('friend_event')} where at >= ?`, [since]);
    const [ge] = await q(`select count(*) as n from ${T('game_event')} where at >= ?`, [since]);
    const [fr] = await q(`select count(*) as n from ${T('friend')}`, []);
    const [wo] = await q(`select count(*) as n from ${T('world')}`, []);
    const events24h = Number(ev?.n ?? 0);
    const friendsTracked = Number(fr?.n ?? 0);
    const worldsTracked = Number(wo?.n ?? 0);
    const lastMsgAt = s?.last_msg_at ? iso(s.last_msg_at) : null;
    return {
      ok: true,
      db: db.dialect,
      collector: {
        connected: !!Number(s?.connected ?? 0),
        lastMsgAt,
        // 距上次 pipeline 消息多久：采集器活着但没消息也算信息
        idleMinutes: lastMsgAt ? Math.round((Date.now() - new Date(lastMsgAt)) / 60000) : null,
        msgCount: Number(s?.msg_count ?? 0),
        lastError: s?.last_error ?? null,
      },
      rate24h: {
        events: events24h,
        perHour: Math.round((events24h / 24) * 10) / 10,
        gameEvents: Number(ge?.n ?? 0),
      },
      friendsTracked,
      worldsTracked,
      cache: {
        dir: cacheDir,
        files: fs.readdirSync(cacheDir).filter((f) => f.endsWith('.bin')).length,
      },
    };
  });
}
