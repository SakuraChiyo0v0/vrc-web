import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db/index.js';
import { dbUrl } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.VRC_WEB_DIST || path.join(__dirname, '../../web/dist');

const db = await openDb(dbUrl());
const T = (n) => db.tbl(n);
const iso = (v) => (v instanceof Date ? v.toISOString() : v);

const app = Fastify({ logger: false });
await app.register(fastifyStatic, { root: WEB_DIST, prefix: '/' });

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
  const rows = await db.query(
    `select f.user_id, f.display_name, f.status, f.status_description, f.location,
            f.world_id, coalesce(w.name, f.world_name) as world_name, f.platform, f.icon_url, f.updated_at
       from ${T('friend')} f left join ${T('world')} w on w.id = f.world_id
      ${only ? "where f.location is not null and f.location not in ('offline','private','traveling')" : ''}
      order by case when f.location is null or f.location in ('offline','private','traveling') then 1 else 0 end,
               f.display_name`,
  );
  return { total: rows.length, friends: rows.map((r) => ({ ...r, updated_at: iso(r.updated_at) })) };
});

app.get('/api/events', async (req) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const kind = req.query.kind;
  const rows = await db.query(
    `select e.id, e.user_id, coalesce(e.display_name, f.display_name) as display_name,
            f.icon_url, e.kind, e.location, e.world_id,
            coalesce(e.world_name, w.name) as world_name, e.at
       from ${T('friend_event')} e
       left join ${T('friend')} f on f.user_id = e.user_id
       left join ${T('world')} w on w.id = e.world_id
      ${kind ? 'where e.kind = ?' : ''}
      order by e.at desc limit ?`,
    kind ? [kind, limit] : [limit],
  );
  return { returned: rows.length, events: rows.map((r) => ({ ...r, at: iso(r.at) })) };
});

app.get('/api/stats', async () => {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const byKind = await db.query(
    `select kind, count(*) as n from ${T('friend_event')} where at > ? group by kind order by n desc`,
    [cutoff],
  );
  const topWorlds = await db.query(
    `select coalesce(w.name, e.world_name, e.world_id) as world,
            count(distinct e.user_id) as people, count(*) as events
       from ${T('friend_event')} e left join ${T('world')} w on w.id = e.world_id
      where e.at > ? and e.world_id is not null
      group by coalesce(w.name, e.world_name, e.world_id)
      order by events desc limit 8`,
    [cutoff],
  );
  const rows = await db.query(`select at from ${T('friend_event')} where at > ? order by at`, [cutoff]);
  const buckets = new Map();
  for (const r of rows) {
    const key = String(iso(r.at)).slice(0, 13);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return {
    byKind: byKind.map((r) => ({ kind: r.kind, n: Number(r.n) })),
    topWorlds: topWorlds.map((r) => ({ world: r.world, people: Number(r.people), events: Number(r.events) })),
    hourly: [...buckets.entries()].map(([h, n]) => ({ h, n })),
  };
});

app.get('/api/notifications', async () => {
  const rows = await db.query(
    `select id, type, sender_user_id, message, link, created_at, seen
       from ${T('notification')} order by created_at desc limit 50`,
  );
  return {
    returned: rows.length,
    notifications: rows.map((r) => ({ ...r, seen: !!Number(r.seen), created_at: iso(r.created_at) })),
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
app.get('/api/players', async () => {
  const rows = await db.query(
    `select display_name, user_id, world_name, at from ${T('game_event')} where kind = 'room_join' order by at desc`,
  );
  const map = new Map();
  for (const r of rows) {
    const key = r.user_id ?? r.display_name;
    const cur = map.get(key);
    if (cur) cur.meets += 1;
    else map.set(key, {
      name: r.display_name ?? r.user_id, user_id: r.user_id, meets: 1,
      last_seen: iso(r.at), last_world: r.world_name ?? null,
    });
  }
  return { returned: map.size, players: [...map.values()].sort((a, b) => b.meets - a.meets).slice(0, 200) };
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
const retentionDays = (() => {
  const n = Number(process.env.VRC_EVENT_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
})();

async function purgeOldEvents() {
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
