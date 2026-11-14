/**
 * VRChat 采集器：cookie 登录态 → pipeline WebSocket 常驻 → 事件归一化落 PG。
 * 单进程常驻；断线指数退避重连，每次重连重新换 token。
 */
import fs from 'node:fs';
import WS from 'ws';
import { q, worldIdOf } from './db.js';

const SESSION_FILE = process.env.VRC_SESSION_FILE || '/opt/astra/home/vr-session.json';
const UA = 'vrc-web/0.1 (self-hosted)';
const API = 'https://api.vrchat.cloud/api/1';
const MAX_BACKOFF = 60_000;

let ws = null;
let backoff = 2_000;
let msgCount = 0;
let lastTouch = 0;
let lastMsgTs = Date.now();
const worldCache = new Map();     // world_id -> name（内存级，进程重启再查）

function cookie() {
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')).cookie;
}

async function api(path, { method = 'GET' } = {}) {
  const r = await fetch(API + path, { method, headers: { cookie: cookie(), 'user-agent': UA } });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
  return r.json();
}

async function pipelineToken() {
  const j = await api('/auth');
  if (!j?.token) throw new Error('auth 未返回 token');
  return j.token;
}

async function upsertWorld(worldId) {
  if (!worldId || worldCache.has(worldId)) return worldCache.get(worldId) ?? null;
  try {
    const w = await api(`/worlds/${worldId}`);
    worldCache.set(worldId, w.name ?? null);
    await q(
      `insert into vrc.world (id, name, author_id, author_name, capacity, thumbnail, updated_at)
       values ($1,$2,$3,$4,$5,$6,now())
       on conflict (id) do update set name=excluded.name, author_id=excluded.author_id,
         author_name=excluded.author_name, capacity=excluded.capacity,
         thumbnail=excluded.thumbnail, updated_at=now()`,
      [worldId, w.name, w.authorId, w.authorName, w.capacity, w.thumbnailImageUrl],
    );
    return w.name ?? null;
  } catch (e) {
    worldCache.set(worldId, null);
    return null;
  }
}

async function touchState(patch) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  if (!sets.length) return;
  await q(`update vrc.collector_state set ${sets.join(', ')} where id = 1`, vals);
}

async function upsertFriend(f) {
  await q(
    `insert into vrc.friend (user_id, display_name, trust_level, platform, status, status_description,
                             location, world_id, world_name, avatar_id, icon_url, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     on conflict (user_id) do update set
       display_name = coalesce(excluded.display_name, vrc.friend.display_name),
       trust_level = coalesce(excluded.trust_level, vrc.friend.trust_level),
       platform = coalesce(excluded.platform, vrc.friend.platform),
       status = coalesce(excluded.status, vrc.friend.status),
       status_description = coalesce(excluded.status_description, vrc.friend.status_description),
       location = coalesce(excluded.location, vrc.friend.location),
       world_id = coalesce(excluded.world_id, vrc.friend.world_id),
       world_name = coalesce(excluded.world_name, vrc.friend.world_name),
       avatar_id = coalesce(excluded.avatar_id, vrc.friend.avatar_id),
       icon_url = coalesce(excluded.icon_url, vrc.friend.icon_url),
       updated_at = now()`,
    [f.userId ?? f.id, f.displayName ?? null, f.trustLevel ?? null, f.platform ?? null, f.status ?? null,
     f.statusDescription ?? null, f.location ?? null, worldIdOf(f.location), f.worldName ?? null,
     f.currentAvatarThumbnailImageUrl ?? null, f.iconUrl ?? null],
  );
}

async function logEvent(kind, { userId, displayName, location, worldName, payload }) {
  const wid = worldIdOf(location);
  let wname = worldName ?? null;
  if (wid && !wname) wname = await upsertWorld(wid);
  await q(
    `insert into vrc.friend_event (user_id, display_name, kind, location, world_id, world_name, payload)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [userId ?? null, displayName ?? null, kind, location ?? null, wid, wname, payload ?? null],
  );
}

/** 上游事件里 user 资料可能只在 content.user，也可能只有 userId */
function friendOf(content) {
  const u = content.user ?? {};
  return {
    id: content.userId ?? u.id ?? u.userId ?? content.id,
    ...u,
    platform: u.platform ?? content.platform,
    location: content.location ?? u.location,
  };
}

/** 把上游 30+ 种 type 归一成少量 kind */
async function handle(type, content) {
  switch (type) {
    case 'friend-online':
    case 'friend-active': {
      const f = friendOf(content);
      await upsertFriend(f);
      await logEvent(type === 'friend-online' ? 'online' : 'active', {
        userId: f.id, displayName: f.displayName, location: f.location, payload: null,
      });
      break;
    }
    case 'friend-offline': {
      const f = friendOf(content);
      await upsertFriend({ ...f, location: 'offline' });
      await logEvent('offline', { userId: f.id, displayName: f.displayName });
      break;
    }
    case 'friend-location': {
      const f = friendOf(content);
      const loc = content.location ?? f.location;
      await upsertFriend({ ...f, location: loc });
      await logEvent('location', {
        userId: f.id, displayName: f.displayName, location: loc,
        payload: { previous: content.previousLocation ?? null },
      });
      break;
    }
    case 'friend-update': {
      const f = friendOf(content);
      await upsertFriend(f);
      await logEvent('profile', { userId: f.id, displayName: f.displayName, payload: { fields: Object.keys(content) } });
      break;
    }
    case 'friend-add':
    case 'friend-delete': {
      const f = friendOf(content);
      await logEvent(type === 'friend-add' ? 'friend_add' : 'friend_delete', {
        userId: f.id, displayName: f.displayName,
      });
      break;
    }
    case 'user-location': {
      const loc = content.location ?? null;
      if (loc) {
        await q('insert into vrc.self_event (kind, location, world_id) values ($1,$2,$3)',
          [loc === 'offline' ? 'offline' : 'location', loc, worldIdOf(loc)]);
        if (worldIdOf(loc)) await upsertWorld(worldIdOf(loc));
      }
      break;
    }
    case 'user-update': {
      const u = content.user ?? content;
      await logEvent('self_profile', { userId: u.id, displayName: u.displayName, payload: null });
      break;
    }
    default: {
      if (type.startsWith('notification')) {
        const n = content.notification ?? content;
        if (n?.id) {
          await q(
            `insert into vrc.notification (id, type, sender_user_id, message, link, created_at, payload)
             values ($1,$2,$3,$4,$5,$6,$7)
             on conflict (id) do update set seen = vrc.notification.seen`,
            [n.id, n.type ?? type, n.senderUserId ?? null, n.message ?? null, n.link ?? null,
             n.createdAt ?? null, n],
          );
        }
      }
      // 其它类型先不落库，保留计数
      break;
    }
  }
}

async function seedFriends() {
  const me = await api('/auth/user');
  // /auth/user 只返回好友 id 列表，完整资料要逐个 /users/{id} 拿（限速：4 并发 + 200ms）
  const ids = (me.friends ?? []).filter((x) => typeof x === 'string');
  let done = 0;
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const f = await api(`/users/${id}`);
        await upsertFriend(f);
      } catch (e) {
        console.error('[seed]', id, e.message);
      }
      done++;
      await new Promise((r) => setTimeout(r, 200));
    }
  }));
  await q(
    `insert into vrc.account (vrchat_user_id, display_name, last_ok_at)
     values ($1,$2,now())
     on conflict (vrchat_user_id) do update set display_name=excluded.display_name, last_ok_at=now()`,
    [me.id, me.displayName],
  );
  console.log(`[seed] ${done}/${ids.length} friends, me=${me.displayName}`);
  return me;
}

async function connect() {
  const token = await pipelineToken();
  ws = new WS(`wss://pipeline.vrchat.cloud/?auth=${encodeURIComponent(token)}`, {
    headers: { 'user-agent': UA },
  });

  ws.on('open', async () => {
    backoff = 2_000;
    console.log('[ws] connected');
    await touchState({ connected: true, last_error: null });
  });

  ws.on('message', async (raw) => {
    msgCount++;
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    lastMsgTs = Date.now();
    console.log(new Date().toISOString(), 'msg', m.type);
    if (['friend-offline', 'friend-online', 'friend-location', 'friend-update'].includes(m.type)) {
      try {
        fs.appendFileSync('/opt/data/logs/vrc-raw-events.jsonl',
          JSON.stringify({ t: Date.now(), type: m.type, content: m.content }) + '\n');
      } catch { /* ignore */ }
    }
    try {
      // content 有时是 JSON 字符串（VRChat 对部分事件做了二次编码）
      let content = m.content ?? {};
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch { content = {}; }
      }
      await handle(m.type, content);
      const now = Date.now();
      if (now - lastTouch > 10_000) {
        lastTouch = now;
        await touchState({ last_msg_at: new Date(), msg_count: msgCount });
      }
    } catch (e) {
      console.error('[handle]', m.type, e.message);
    }
  });

  ws.on('close', async (code) => {
    console.log('[ws] closed', code, 'reconnect in', backoff, 'ms');
    await touchState({ connected: false, last_error: `closed ${code}` });
    setTimeout(connect, backoff).unref?.();
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  });

  ws.on('error', (e) => console.error('[ws] error', e.message));
  ws.on('unexpected-response', (_req, res) => console.error('[ws] http', res.statusCode));
}

/** 好友所在世界名补齐：每 2 分钟最多补 10 个未缓存的世界 */
async function resolveWorlds() {
  try {
    const rows = await q(
      `select distinct f.world_id from vrc.friend f
        left join vrc.world w on w.id = f.world_id
       where f.world_id is not null and w.id is null limit 10`,
    );
    for (const r of rows) {
      await upsertWorld(r.world_id);
      await new Promise((res) => setTimeout(res, 300));
    }
  } catch (e) {
    console.error('[worlds]', e.message);
  }
}

async function main() {
  await seedFriends();
  await resolveWorlds();
  setInterval(resolveWorlds, 120_000).unref();
  // 每小时全量校准一次好友资料（WS 可能漏事件）
  setInterval(() => seedFriends().catch((e) => console.error('[seed]', e.message)), 3_600_000).unref();
  await connect();
  setInterval(() => {
    if (!ws || ws.readyState !== WS.OPEN) return;
    try { ws.ping(); } catch { /* ignore */ }
  }, 30_000);

  // 十分钟没有任何消息就主动重连：pipeline 偶发静默断流，readyState 仍是 OPEN
  setInterval(() => {
    if (ws && ws.readyState === WS.OPEN && Date.now() - lastMsgTs > 600_000) {
      console.warn('[ws] silent for 10min, reconnecting');
      try { ws.terminate(); } catch { /* ignore */ }
    }
  }, 60_000).unref();

  // 心跳：即使没有事件也每分钟刷新一次状态，前端才能看出「活着但安静」
  setInterval(async () => {
    const open = !!ws && ws.readyState === WS.OPEN;
    try {
      await touchState({ connected: open, msg_count: msgCount });
    } catch (e) {
      console.error('[heartbeat]', e.message);
    }
  }, 60_000).unref();
  process.on('SIGINT', async () => {
    await touchState({ connected: false });
    process.exit(0);
  });
}

export { handle, friendOf };

if (!process.env.VRC_NO_MAIN) {
  main().catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  });
}
