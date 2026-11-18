import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db/index.js';
import { dbUrl } from './config.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerInsightRoutes } from './routes/insights.js';
import { registerExtRoutes } from './routes/ext.js';
import { registerShareRoutes } from './routes/share.js';
import { registerRound2Routes } from './routes/round2.js';
import { registerRound3Routes } from './routes/round3.js';
import { registerRound4Routes } from './routes/round4.js';
import { registerRound5Routes } from './routes/round5.js';
import { registerRound6Routes } from './routes/round6.js';
import { registerRound7Routes } from './routes/round7.js';
import { aggregateNotifications } from './lib/notif.js';
import { matchText } from '../../web/src/lib/pinyin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.VRC_WEB_DIST || path.join(__dirname, '../../web/dist');

const db = await openDb(dbUrl());
const T = (n) => db.tbl(n);
const iso = (v) => (v instanceof Date ? v.toISOString() : v);

const app = Fastify({
  logger: false,
  // 直连（不经 nginx）时前端会把 API 也带上 /vrc/ 前缀：路由前统一剥掉，
  // 否则 /vrc/assets/* 能开、/vrc/api/* 全 404，页面永远停在「读取中」。
  rewriteUrl: (req) => (req.url?.startsWith('/vrc/') ? req.url.slice(4) || '/' : req.url),
});
// index.html 不能长缓存：每次发版 JS/CSS 文件名都会变，缓存旧的 index 会指向已删除的 asset（白屏）
const staticOpts = { root: WEB_DIST };
// 公网隧道访问的口令门：只有 Host 命中隧道域名时才校验，内网/中继（已自带登录）不受影响
const PUBLIC_TOKEN = process.env.VRC_PUBLIC_TOKEN || '';
const PUBLIC_HOST_HINTS = (process.env.VRC_PUBLIC_HOSTS || 'trycloudflare.com').split(',');
// 直连（不经 nginx）时前端会把 API 也带上 /vrc/ 前缀：统一在这里剥掉，
// 否则 /vrc/assets/* 能开、/vrc/api/* 全 404，页面永远停在「读取中」。
app.addHook('onRequest', async (req) => {
  if (req.raw.url?.startsWith('/vrc/')) req.raw.url = req.raw.url.slice(4) || '/';
});
app.addHook('onRequest', async (req, reply) => {
  if (!PUBLIC_TOKEN) return;
  const host = String(req.headers.host || '');
  if (!PUBLIC_HOST_HINTS.some((h) => h && host.includes(h))) return;
  const url = new URL(req.raw.url, 'http://x');
  // 没有 @fastify/cookie：手写解析 Cookie 头
  const cookieHeader = String(req.headers.cookie || '');
  const cookieToken = (cookieHeader.match(/(?:^|;\s*)vrc_k=([^;]+)/) || [])[1] || '';
  const given = cookieToken || url.searchParams.get('k') || '';
  if (given === PUBLIC_TOKEN) {
    // 没用 @fastify/cookie，直接写头，否则子资源（js/css）拿不到 cookie 会 401 白屏
    reply.header('set-cookie', `vrc_k=${PUBLIC_TOKEN}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
    return;
  }
  reply.code(401).type('text/html; charset=utf-8').send(
    `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">`
    + `<div style="font:16px/1.6 system-ui;padding:48px;max-width:520px;margin:0 auto">`
    + `<h2>需要访问口令</h2><p>在地址后加 <code>?k=你的口令</code> 打开一次，之后浏览器会记住。</p></div>`,
  );
});

app.addHook('onSend', async (req, reply, payload) => {
  if (req.url.endsWith('index.html') || req.url.endsWith('/')) {
    reply.header('cache-control', 'no-cache, must-revalidate');
  } else if (req.url.includes('/assets/')) {
    reply.header('cache-control', 'public, max-age=31536000, immutable');
  }
  return payload;
});
await app.register(fastifyStatic, { ...staticOpts, prefix: '/' });
// 同一份前端也挂在 /vrc/ 下：内网 nginx 会剥掉前缀，直连 8791 的访问带前缀，两边都要能开
await app.register(fastifyStatic, { ...staticOpts, prefix: '/vrc/', decorateReply: false });
registerLibraryRoutes(app, { db, T, iso });
registerInsightRoutes(app, { db, T, iso });
registerExtRoutes(app, { db, T, iso });
registerShareRoutes(app, { db, T, iso });
registerRound2Routes(app, { db, T, iso });
registerRound3Routes(app, { db, T, iso });
registerRound4Routes(app, { db, T, iso });
registerRound5Routes(app, { db, T, iso });
registerRound6Routes(app, { db, T, iso });
registerRound7Routes(app, { db, T, iso });

app.get('/api/health', async () => {
  const [s] = await db.query(
    `select connected, last_msg_at, msg_count, last_error from ${T('collector_state')} where id = 1`,
  );
  return {
    ok: true,
    db: { kind: db.dialect },
    collector: s
      ? {
          connected: !!Number(s.connected),
          lastMsgAt: s.last_msg_at ? iso(s.last_msg_at) : null,
          msgCount: Number(s.msg_count ?? 0),
          lastError: s.last_error ?? null,
        }
      : { connected: false, lastMsgAt: null, msgCount: 0, lastError: null },
  };
});

app.get('/api/status', async () => {
  const [s] = await db.query(`select connected, last_msg_at, msg_count, last_error from ${T('collector_state')} where id = 1`);
  const [acc] = await db.query(`select vrchat_user_id, display_name, last_ok_at from ${T('account')} order by id limit 1`);
  const [cnt] = await db.query(
    `select count(*) as total,
            sum(case when location is not null and location not in ('offline','private','traveling') then 1 else 0 end) as online
       from ${T('friend')}`,
  );
  return {
    dialect: db.dialect,
    collector: s ? { ...s, connected: !!Number(s.connected), last_msg_at: iso(s.last_msg_at) } : null,
    account: acc ? { ...acc, last_ok_at: iso(acc.last_ok_at) } : null,
    friends: { total: Number(cnt?.total ?? 0), online: Number(cnt?.online ?? 0) },
  };
});

app.get('/api/friends', async (req) => {
  const only = req.query.online === '1';
  /** 105 搜索：与前端同一份 matchText（拼音首字母 / 子串 / 中英混排），服务端也认 q */
  const q = String(req.query.q ?? '').trim();
  const rows = await db.query(
    `select f.user_id, f.display_name, f.status, f.status_description, f.location,
            f.world_id, coalesce(w.name, f.world_name) as world_name, f.platform, f.icon_url, f.updated_at
       from ${T('friend')} f left join ${T('world')} w on w.id = f.world_id
      ${only ? "where f.location is not null and f.location not in ('offline','private','traveling')" : ''}
      order by case when f.location is null or f.location in ('offline','private','traveling') then 1 else 0 end,
               f.display_name`,
  );
  const list = q ? rows.filter((r) => matchText(r.display_name, q) || matchText(r.world_name, q)) : rows;
  return { total: list.length, friends: list.map((r) => ({ ...r, updated_at: iso(r.updated_at) })) };
});

app.get('/api/events', async (req) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);
  const where = [];
  const params = [];
  if (req.query.kind) { where.push('e.kind = ?'); params.push(String(req.query.kind)); }
  if (req.query.since) { where.push('e.at >= ?'); params.push(String(req.query.since)); }
  if (req.query.until) { where.push('e.at < ?'); params.push(String(req.query.until)); }
  if (req.query.user_id) { where.push('e.user_id = ?'); params.push(String(req.query.user_id)); }
  const rows = await db.query(
    `select e.id, coalesce(e.user_id, fn.user_id) as user_id,
            coalesce(e.display_name, f.display_name) as display_name,
            coalesce(f.icon_url, fn.icon_url) as icon_url, e.kind, e.location, e.world_id,
            coalesce(e.world_name, w.name) as world_name, e.at
       from ${T('friend_event')} e
       left join ${T('friend')} f on f.user_id = e.user_id
       -- 67 历史事件可能只存了名字（采集器早期版本/事件先于好友表）：按名字兜底解析成 userId，
       -- 这样动态里的每条人名都能点开好友抽屉，而不是死文本
       left join ${T('friend')} fn on fn.display_name = e.display_name and e.user_id is null
       left join ${T('world')} w on w.id = e.world_id
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by e.at desc limit ? offset ?`,
    [...params, limit + 1, offset],
  );
  const has_more = rows.length > limit;
  const events = (has_more ? rows.slice(0, limit) : rows).map((r) => ({ ...r, at: iso(r.at) }));
  return { returned: events.length, limit, offset, has_more, events };
});

/** 26 统计：days 天窗口 + 24×7 热力图（按 +08:00 切日/切小时） */
app.get('/api/stats', async (req) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const TZ = 8 * 3600_000;
  const now = Date.now();
  const startIso = new Date(now - days * 86400_000).toISOString();
  const byKind = await db.query(
    `select kind, count(*) as n from ${T('friend_event')} where at > ? group by kind order by n desc`,
    [startIso],
  );
  const topWorlds = await db.query(
    `select coalesce(w.name, e.world_name, e.world_id) as world,
            count(distinct e.user_id) as people, count(*) as events
       from ${T('friend_event')} e left join ${T('world')} w on w.id = e.world_id
      where e.at > ? and e.world_id is not null
      group by coalesce(w.name, e.world_name, e.world_id)
      order by events desc limit 8`,
    [startIso],
  );

  const dayKey = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dayKey(now - i * 86400_000));
  const idx = new Map(dates.map((d, i) => [d, i]));
  const hourly = dates.map(() => new Array(24).fill(0));

  const rows = await db.query(`select at from ${T('friend_event')} where at > ? order by at`, [startIso]);
  for (const r of rows) {
    const ms = new Date(iso(r.at)).getTime();
    const i = idx.get(dayKey(ms));
    if (i === undefined) continue;
    const h = new Date(ms + TZ).getUTCHours();
    hourly[i][h] += 1;
  }
  const total = hourly.flat().reduce((a, b) => a + b, 0);

  return {
    days,
    tz: '+08:00',
    dates,
    hourly,
    max: Math.max(1, ...hourly.flat()),
    total,
    byKind: byKind.map((r) => ({ kind: r.kind, n: Number(r.n) })),
    topWorlds: topWorlds.map((r) => ({ world: r.world, people: Number(r.people), events: Number(r.events) })),
  };
});

app.get('/api/notifications', async (req) => {
  const where = [];
  const params = [];
  if (req.query.unread === '1') { where.push('seen = ?'); params.push(false); }
  const kind = req.query.kind ?? req.query.type;
  if (kind) { where.push('type = ?'); params.push(String(kind)); }
  const rows = await db.query(
    `select id, type, sender_user_id, message, link, created_at, seen
       from ${T('notification')} ${where.length ? `where ${where.join(' and ')}` : ''}
      order by created_at desc limit 200`,
    params,
  );
  const [un] = await db.query(`select count(*) as n from ${T('notification')} where seen = ?`, [false]);
  const senders = [...new Set(rows.map((r) => r.sender_user_id).filter(Boolean))];
  const nameMap = new Map();
  if (senders.length) {
    const names = await db.query(
      `select user_id, display_name from ${T('friend')} where user_id in (${senders.map(() => '?').join(',')})`,
      senders,
    );
    for (const r of names) nameMap.set(r.user_id, r.display_name);
  }
  const items = rows.map((r) => ({
    ...r,
    kind: r.type,
    seen: !!Number(r.seen),
    sender_name: r.sender_user_id ? (nameMap.get(r.sender_user_id) ?? null) : null,
    created_at: iso(r.created_at),
  }));

  /**
   * 104 通知同类聚合：同 type 且距该组最新一条 <24h 的合并成一条。
   *   group=0 关掉（调试/老调用方），默认聚合。
   * 每条带 count / ids / items（组内原文，按时间倒序），标已读一次带走整组。
   */
  const grouped = req.query.group !== '0';
  if (!grouped) {
    return {
      returned: items.length,
      unread_count: Number(un?.n ?? 0),
      types: [...new Set(items.map((r) => r.type).filter(Boolean))],
      grouped: false,
      notifications: items,
    };
  }

  const groups = aggregateNotifications(items);

  return {
    returned: items.length,
    groups: groups.length,
    unread_count: Number(un?.n ?? 0),
    types: [...new Set(items.map((r) => r.type).filter(Boolean))],
    grouped: true,
    notifications: groups,
  };
});

/** 好友会话：把每个人的位置事件串成区间（JS 推导，两端一致） */
async function friendSessions() {
  const rows = await db.query(
    `select user_id, display_name, kind, location, world_id, world_name, at
       from ${T('friend_event')}
      where kind in ('online','location','offline','active')
      order by user_id, at`,
  );
  const out = [];
  const last = new Map();
  for (const r of rows) {
    const prev = last.get(r.user_id);
    if (prev?.world_id) {
      const mins = Math.round((new Date(iso(r.at)) - new Date(prev.start_at)) / 60000);
      if (mins >= 0) out.push({ ...prev, end_at: iso(r.at), minutes: mins });
    }
    const staying = (r.kind === 'online' || r.kind === 'location')
      && r.location && !['offline', 'private', 'traveling'].includes(r.location);
    last.set(r.user_id, staying
      ? { user_id: r.user_id, display_name: r.display_name, location: r.location,
          world_id: r.world_id, world_name: r.world_name, start_at: iso(r.at) }
      : null);
  }
  return out;
}

app.get('/api/sessions', async (req) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const sessions = (await friendSessions()).sort((a, b) => (a.start_at < b.start_at ? 1 : -1)).slice(0, limit);
  const worlds = new Map((await db.query(`select id, name from ${T('world')}`)).map((w) => [w.id, w.name]));
  return {
    returned: sessions.length,
    sessions: sessions.map((s) => ({ ...s, world: worlds.get(s.world_id) ?? s.world_name ?? s.world_id })),
  };
});

/** 我自己的行程：self_event 串区间 */
app.get('/api/my-sessions', async () => {
  const rows = await db.query(`select kind, location, world_id, at from ${T('self_event')} order by at`);
  const worlds = new Map((await db.query(`select id, name from ${T('world')}`)).map((w) => [w.id, w.name]));
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind !== 'location' || !r.location || String(r.location).startsWith('offline')) continue;
    const next = rows[i + 1];
    out.push({
      world: worlds.get(r.world_id) ?? r.world_id,
      location: r.location,
      start_at: iso(r.at),
      end_at: next ? iso(next.at) : null,
      minutes: next ? Math.round((new Date(iso(next.at)) - new Date(iso(r.at))) / 60000) : null,
    });
  }
  const sessions = out.reverse();
  return { returned: sessions.length, sessions };
});

/** 同房玩家：game_event 聚合 */
app.get('/api/players', async (req) => {
  const minMeets = Math.max(1, Number(req.query.min_meets ?? 1) || 1);
  const rows = await db.query(
    `select display_name, user_id, world_name, at from ${T('game_event')} where kind = 'room_join' order by at desc`,
  );
  const map = new Map();
  for (const r of rows) {
    const key = r.user_id ?? r.display_name;
    const cur = map.get(key);
    if (cur) {
      cur.meets += 1;
      if (cur.last_world !== r.world_name) cur.worlds.push(r.world_name);
    } else map.set(key, {
      name: r.display_name ?? r.user_id, user_id: r.user_id, meets: 1,
      last_seen: iso(r.at), last_world: r.world_name ?? null,
      worlds: r.world_name ? [r.world_name] : [],
    });
  }
  const players = [...map.values()]
    .filter((p) => p.meets >= minMeets)
    .sort((a, b) => b.meets - a.meets || (a.last_seen < b.last_seen ? 1 : -1))
    .slice(0, 200);
  return { returned: players.length, min_meets: minMeets, players };
});

function ingestToken() {
  if (process.env.VRC_INGEST_TOKEN) return process.env.VRC_INGEST_TOKEN;
  const f = process.env.VRC_INGEST_TOKEN_FILE || '/opt/data/state/vrc-web/ingest.token';
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; }
}

app.post('/ingest/log', async (req, reply) => {
  const token = req.headers['x-ingest-token'];
  if (!token || token !== ingestToken()) return reply.code(401).send({ ok: false });
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
  let n = 0;
  for (const e of events) {
    if (!e?.kind || !e?.at) continue;
    await db.query(
      `insert into ${T('game_event')} (kind, display_name, user_id, location, world_name, detail, at)
       values (?,?,?,?,?,?,?)`,
      [e.kind, e.displayName ?? null, e.userId ?? null, e.location ?? null, e.worldName ?? null,
       e.detail ? JSON.stringify(e.detail) : null, e.at],
    );
    n++;
  }
  return { ok: true, inserted: n };
});

/** 事件留存：清理 N 天前的事件，启动时 + 每 24h 各跑一次 */
// 0 = 永久保留（历史事件是趋势分析的基础，默认不再删）
const retentionDays = (() => {
  const n = Number(process.env.VRC_EVENT_RETENTION_DAYS);
  if (Number.isFinite(n) && n === 0) return null;
  return Number.isFinite(n) && n > 0 ? n : null;
})();

async function purgeOldEvents() {
  if (!retentionDays) { console.log('[retention] 永久保留，跳过清理'); return 0; }
  const cutoff = new Date(Date.now() - retentionDays * 86400_000).toISOString();
  let total = 0;
  for (const table of ['friend_event', 'self_event', 'game_event']) {
    try {
      const [c] = await db.query(`select count(*) as n from ${T(table)} where at < ?`, [cutoff]);
      await db.query(`delete from ${T(table)} where at < ?`, [cutoff]);
      const n = Number(c?.n ?? 0);
      total += n;
      console.log(`[retention] ${table}: deleted ${n} rows older than ${retentionDays}d`);
    } catch (e) {
      console.error(`[retention] ${table}:`, e.message);
    }
  }
  return total;
}

const port = Number(process.env.PORT ?? 8790);
await app.listen({ port, host: '0.0.0.0' });
console.log(`[api] http://0.0.0.0:${port} (db=${db.dialect})`);
purgeOldEvents().catch((e) => console.error('[retention]', e.message));
setInterval(() => purgeOldEvents().catch((e) => console.error('[retention]', e.message)), 24 * 3600_000).unref();
