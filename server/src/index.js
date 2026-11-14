import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = process.env.VRC_WEB_DIST || path.join(__dirname, '../../web/dist');

const app = Fastify({ logger: false });

await app.register(fastifyStatic, { root: WEB_DIST, prefix: '/' });

const online = (loc) => loc && loc !== 'offline' && loc !== 'private' && loc !== 'traveling';

app.get('/api/status', async () => {
  const [s] = await q('select connected, last_msg_at, msg_count, last_error from vrc.collector_state where id = 1');
  const [acc] = await q('select vrchat_user_id, display_name, last_ok_at from vrc.account order by id limit 1');
  const [cnt] = await q('select count(*)::int as total, count(*) filter (where location not in (\'offline\',\'private\',\'traveling\') and location is not null)::int as online from vrc.friend');
  return { collector: s ?? null, account: acc ?? null, friends: cnt };
});

app.get('/api/friends', async (req) => {
  const only = req.query.online === '1';
  const rows = await q(
    `select f.user_id, f.display_name, f.status, f.status_description, f.location,
            f.world_id, coalesce(w.name, f.world_name) as world_name, f.platform, f.icon_url, f.updated_at
       from vrc.friend f left join vrc.world w on w.id = f.world_id
      ${only ? "where f.location is not null and f.location not in ('offline','private','traveling')" : ''}
      order by (f.location is null or f.location in ('offline','private','traveling')), f.display_name`,
  );
  return { total: rows.length, friends: rows };
});

app.get('/api/events', async (req) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const kind = req.query.kind;
  const rows = await q(
    `select e.id, e.user_id, coalesce(e.display_name, f.display_name) as display_name,
            f.icon_url, e.kind, e.location, e.world_id, coalesce(e.world_name, w.name) as world_name, e.at
       from vrc.friend_event e
       left join vrc.friend f on f.user_id = e.user_id
       left join vrc.world w on w.id = e.world_id
      ${kind ? 'where e.kind = $2' : ''}
      order by e.at desc limit $1`,
    kind ? [limit, kind] : [limit],
  );
  return { returned: rows.length, events: rows };
});

app.get('/api/stats', async () => {
  const byKind = await q(
    `select kind, count(*)::int as n from vrc.friend_event
      where at > now() - interval '24 hours' group by kind order by n desc`,
  );
  const topWorlds = await q(
    `select coalesce(w.name, e.world_name, e.world_id) as world, count(distinct e.user_id)::int as people,
            count(*)::int as events
       from vrc.friend_event e left join vrc.world w on w.id = e.world_id
      where e.at > now() - interval '24 hours' and e.world_id is not null
      group by 1 order by events desc limit 8`,
  );
  const hourly = await q(
    `select date_trunc('hour', at) as h, count(*)::int as n from vrc.friend_event
      where at > now() - interval '24 hours' group by 1 order by 1`,
  );
  return { byKind, topWorlds, hourly };
});

app.get('/api/notifications', async () => {
  const rows = await q(
    `select id, type, sender_user_id, message, link, created_at, seen
       from vrc.notification order by created_at desc nulls last limit 50`,
  );
  return { returned: rows.length, notifications: rows };
});


// ---- 会话 / 玩家 / 日志上报 ----

app.get('/api/sessions', async (req) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const rows = await q(
    `select coalesce(w.name, s.world_name) as world, s.world_id, s.start_at, s.end_at, s.minutes, s.display_name
       from vrc.v_session s left join vrc.world w on w.id = s.world_id
      order by s.start_at desc limit $1`,
    [limit],
  );
  return { returned: rows.length, sessions: rows };
});

app.get('/api/my-sessions', async () => {
  const rows = await q(
    `with ev as (select kind, location, world_id, at from vrc.self_event order by at),
          o as (select ev.*, lead(at) over (order by at) as next_at,
                       lead(kind) over (order by at) as next_kind from ev)
     select coalesce(w.name, o.world_id) as world, o.location, o.at as start_at, o.next_at as end_at,
            round(extract(epoch from (o.next_at - o.at)) / 60.0) as minutes
       from o left join vrc.world w on w.id = o.world_id
      where o.kind = 'location' and o.next_at is not null and o.location not like 'offline%'
      order by o.at desc limit 50`,
  );
  return { returned: rows.length, sessions: rows };
});

app.get('/api/players', async () => {
  const rows = await q(
    `select coalesce(g.display_name, g.user_id) as name, g.user_id,
            count(*)::int as meets, max(g.at) as last_seen,
            (array_agg(g.world_name order by g.at desc))[1] as last_world
       from vrc.game_event g
      where g.kind = 'room_join'
      group by 1, 2 order by meets desc limit 200`,
  );
  return { returned: rows.length, players: rows };
});

app.post('/ingest/log', async (req, reply) => {
  const token = req.headers['x-ingest-token'];
  if (!token || token !== ingestToken()) return reply.code(401).send({ ok: false });
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 500) : [];
  let n = 0;
  for (const e of events) {
    if (!e?.kind || !e?.at) continue;
    await q(
      `insert into vrc.game_event (kind, display_name, user_id, location, world_name, detail, at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [e.kind, e.displayName ?? null, e.userId ?? null, e.location ?? null,
       e.worldName ?? null, e.detail ?? null, e.at],
    );
    n++;
  }
  return { ok: true, inserted: n };
});

function ingestToken() {
  if (process.env.VRC_INGEST_TOKEN) return process.env.VRC_INGEST_TOKEN;
  const f = process.env.VRC_INGEST_TOKEN_FILE || '/opt/data/state/vrc-web/ingest.token';
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; }
}

const port = Number(process.env.PORT ?? 8790);
await app.listen({ port, host: '0.0.0.0' });
console.log(`[api] http://0.0.0.0:${port}`);
