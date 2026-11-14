/**
 * VRChat 采集器：cookie 登录态 → pipeline WebSocket 常驻 → 事件归一化落库。
 * 数据库由 db/index.js 适配（PostgreSQL / SQLite 都行），SQL 只写 `?` 占位符。
 * 单进程常驻；断线指数退避重连，每次重连重新换 token。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import WS from 'ws';
import { openDb } from './db/index.js';
import { dbUrl } from './config.js';
import { worldIdOf, trustRankOf, rebuildUser } from './lib/behavior.js';

const SESSION_FILE = process.env.VRC_SESSION_FILE || '/opt/astra/home/vr-session.json';
const UA = 'vrc-web/0.1 (self-hosted)';
const API = 'https://api.vrchat.cloud/api/1';
const MAX_BACKOFF = 60_000;

const db = await openDb(dbUrl());
const T = (n) => db.tbl(n);

let ws = null;
let backoff = 2_000;
let msgCount = 0;
let lastTouch = 0;
let lastMsgTs = Date.now();
const worldCache = new Map();     // world_id -> name（内存级，进程重启再查）

let SESSION = null;   // 内存里的会话，登录成功后写回文件

function session() {
  if (!SESSION) SESSION = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  return SESSION;
}
function cookie() {
  return session().cookie;
}

/** 账号密码：环境变量 VRC_USERNAME/VRC_PASSWORD，或 VRC_CRED_FILE 指向的 json */
function creds() {
  const { VRC_USERNAME, VRC_PASSWORD, VRC_TOTP_SECRET, VRC_CRED_FILE } = process.env;
  if (VRC_USERNAME && VRC_PASSWORD) return { username: VRC_USERNAME, password: VRC_PASSWORD, totp: VRC_TOTP_SECRET };
  if (VRC_CRED_FILE) {
    try {
      const j = JSON.parse(fs.readFileSync(VRC_CRED_FILE, 'utf8'));
      if (j.username && j.password) return { username: j.username, password: j.password, totp: j.totp ?? null };
    } catch { /* 没配置 */ }
  }
  return null;
}

/** RFC 6238 TOTP（VRChat 两步验证用），无密钥直接报错走人工 */
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  const out = [];
  let bits = 0;
  let val = 0;
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const key = Buffer.from(out);
  const buf = Buffer.alloc(8);
  const counter = Math.floor(Date.now() / 30000);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const code = ((h.readUInt32BE(off) & 0x7fffffff) % 1e6).toString().padStart(6, '0');
  return code;
}

/** 用账号密码重新登录，拿新 cookie 并写回会话文件 */
async function relogin() {
  const c = creds();
  if (!c) throw new Error('cookie 失效且未配置账号密码（VRC_USERNAME/VRC_PASSWORD）');
  const basic = 'Basic ' + Buffer.from(`${c.username}:${c.password}`).toString('base64');
  const r = await fetch(`${API}/auth/user`, {
    method: 'GET',
    headers: { authorization: basic, 'user-agent': UA, 'content-type': 'application/json' },
  });
  if (!r.ok) throw new Error(`登录失败 ${r.status}`);
  const setCookie = r.headers.getSetCookie?.() ?? [];
  const jar = setCookie.map((v) => v.split(';')[0]).filter((v) => v.startsWith('auth=') || v.startsWith('twoFactorAuth='));
  if (!jar.length) throw new Error('登录未返回 auth cookie');
  const merged = new Map(session().cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  for (const kv of jar) { const i = kv.indexOf('='); merged.set(kv.slice(0, i), kv.slice(i + 1)); }
  let body = (await r.json().catch(() => null)) ?? null;

  // 需要两步验证：有密钥就自动算，没有就明确报错
  if (body?.requiresTwoFactorAuth?.length) {
    if (!c.totp) throw new Error('账号启用了两步验证，需配置 VRC_TOTP_SECRET');
    const code = totp(c.totp);
    const r2 = await fetch(`${API}/auth/twofactorauth/totp/verify`, {
      method: 'POST',
      headers: { cookie: [...merged].map(([k, v]) => `${k}=${v}`).join('; '), 'user-agent': UA, 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!r2.ok) throw new Error(`两步验证失败 ${r2.status}`);
    for (const v of r2.headers.getSetCookie?.() ?? []) {
      const kv = v.split(';')[0]; const i = kv.indexOf('=');
      if (i > 0) merged.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }

  SESSION = { ...session(), cookie: [...merged].map(([k, v]) => `${k}=${v}`).join('; '), refreshedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(SESSION, null, 2), { mode: 0o600 });
  console.log('[auth] 已用账号密码刷新 cookie');
  return SESSION.cookie;
}

/** 把响应里的 Set-Cookie 合并进会话文件——VRChat 每次调 /auth 都会滑动续期，只要每天有请求就不会过期 */
let lastPersist = 0;
function persistSetCookie(headers) {
  const sc = headers.getSetCookie?.() ?? [];
  if (!sc.length) return;
  const want = sc.map((v) => v.split(';')[0]).filter((kv) => /^(auth|twoFactorAuth)=/.test(kv));
  if (!want.length) return;
  if (Date.now() - lastPersist < 60_000) return;   // 每分钟最多落盘一次
  const merged = new Map(session().cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  for (const kv of want) { const i = kv.indexOf('='); merged.set(kv.slice(0, i), kv.slice(i + 1)); }
  const next = [...merged].map(([k, v]) => `${k}=${v}`).join('; ');
  if (next === session().cookie) return;
  SESSION = { ...session(), cookie: next, refreshedAt: new Date().toISOString() };
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify(SESSION, null, 2), { mode: 0o600 }); lastPersist = Date.now(); console.log('[auth] cookie 已滑动续期'); } catch (e) { console.error('[auth] 写回会话失败', e.message); }
}

async function api(path, { method = 'GET', retry = true } = {}) {
  const r = await fetch(API + path, { method, headers: { cookie: cookie(), 'user-agent': UA } });
  persistSetCookie(r.headers);
  if ((r.status === 401 || r.status === 403) && retry) {
    await relogin();   // cookie 过期：用账号密码换新的，再试一次
    return api(path, { method, retry: false });
  }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
  return r.json();
}

async function pipelineToken() {
  const j = await api('/auth');
  if (!j?.token) throw new Error('auth 未返回 token');
  return j.token;
}

/** 从 location 拆 world id（实现见 lib/behavior.js，第五轮起两处共用一份） */
export { worldIdOf };

async function upsertWorld(worldId) {
  if (!worldId || worldCache.has(worldId)) return worldCache.get(worldId) ?? null;
  try {
    const w = await api(`/worlds/${worldId}`);
    worldCache.set(worldId, w.name ?? null);
    await db.query(
      `insert into ${T('world')} (id, name, author_id, author_name, capacity, thumbnail, updated_at)
       values (?,?,?,?,?,?,?)
       on conflict (id) do update set name = excluded.name, author_id = excluded.author_id,
         author_name = excluded.author_name, capacity = excluded.capacity,
         thumbnail = excluded.thumbnail, updated_at = excluded.updated_at`,
      [worldId, w.name, w.authorId, w.authorName, w.capacity, w.thumbnailImageUrl, new Date()],
    );
    return w.name ?? null;
  } catch (e) {
    worldCache.set(worldId, null);
    return null;
  }
}

async function touchState(patch) {
  const cols = Object.keys(patch);
  if (!cols.length) return;
  const sets = cols.map((c) => `${c} = ?`).join(', ');
  await db.query(`update ${T('collector_state')} set ${sets} where id = 1`, cols.map((c) => patch[c]));
}

/** 53/54/56：会在库里留痕的字段（资料变更 / 状态消息 / 头像） */
const TRACKED_FIELDS = ['display_name', 'status', 'status_description', 'avatar_id', 'icon_url', 'trust_level', 'trust_rank'];

/**
 * 写 friend 表顺带做行为沉淀：
 *   - friend_change          字段级 old→new（53）
 *   - friend_status_history  statusDescription 变更（54）
 *   - friend_avatar_history  头像 / 立绘变更（56）
 *   - friend.trust_rank      由 tags 里的 system_trust_* 解析（56）
 * 返回 { prev, changes, trust }，profile 事件把 changes 写进 payload。
 */
async function upsertFriend(f) {
  const uid = f.userId ?? f.id;
  let prev = null;
  if (uid) {
    try {
      [prev] = await db.query(
        `select user_id, display_name, status, status_description, avatar_id, icon_url, trust_level, trust_rank
           from ${T('friend')} where user_id = ?`, [uid],
      );
    } catch { prev = null; }
  }

  const trust = trustRankOf(f.tags);
  const next = {
    display_name: f.displayName ?? null,
    trust_level: f.trustLevel ?? (trust.label ?? null),
    trust_rank: trust.rank,
    platform: f.platform ?? null,
    status: f.status ?? null,
    status_description: f.statusDescription ?? null,
    location: f.location ?? null,
    world_id: worldIdOf(f.location),
    world_name: f.worldName ?? null,
    avatar_id: f.currentAvatarThumbnailImageUrl ?? null,
    icon_url: f.iconUrl ?? null,
  };

  // 只对「上一次已有值、这一次也有值且不同」的字段记 diff；首次补全不算变更，避免回填噪声
  const changes = [];
  if (prev) {
    for (const fld of TRACKED_FIELDS) {
      const nv = next[fld];
      if (nv === null || nv === undefined) continue;
      const ov = prev[fld] ?? null;
      if (ov === null || ov === undefined) continue;
      if (String(ov) !== String(nv)) changes.push({ field: fld, old: String(ov), new: String(nv) });
    }
  }

  const at = new Date();
  await db.query(
    `insert into ${T('friend')} (user_id, display_name, trust_level, platform, status, status_description,
                                 location, world_id, world_name, avatar_id, icon_url, tags, trust_rank, updated_at)
     values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     on conflict (user_id) do update set
       display_name = coalesce(excluded.display_name, ${T('friend')}.display_name),
       trust_level = coalesce(excluded.trust_level, ${T('friend')}.trust_level),
       platform = coalesce(excluded.platform, ${T('friend')}.platform),
       status = coalesce(excluded.status, ${T('friend')}.status),
       status_description = coalesce(excluded.status_description, ${T('friend')}.status_description),
       location = coalesce(excluded.location, ${T('friend')}.location),
       world_id = coalesce(excluded.world_id, ${T('friend')}.world_id),
       world_name = coalesce(excluded.world_name, ${T('friend')}.world_name),
       avatar_id = coalesce(excluded.avatar_id, ${T('friend')}.avatar_id),
       icon_url = coalesce(excluded.icon_url, ${T('friend')}.icon_url),
       tags = coalesce(excluded.tags, ${T('friend')}.tags),
       trust_rank = coalesce(excluded.trust_rank, ${T('friend')}.trust_rank),
       updated_at = excluded.updated_at`,
    [uid, next.display_name, next.trust_level, next.platform, next.status, next.status_description,
     next.location, next.world_id, next.world_name, next.avatar_id, next.icon_url,
     Array.isArray(f.tags) ? JSON.stringify(f.tags) : null, next.trust_rank, at],
  );

  if (uid) {
    try {
      // 第一次见到这个人：先把当前状态记一条，历史表从一开始就有基线
      if (!prev && (next.status_description || next.status)) {
        await db.query(
          `insert into ${T('friend_status_history')} (user_id, status, description, at) values (?,?,?,?)`,
          [uid, next.status ?? null, next.status_description ?? null, at],
        );
      }
      for (const c of changes) {
        await db.query(
          `insert into ${T('friend_change')} (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`,
          [uid, c.field, c.old, c.new, at],
        );
        if (c.field === 'status_description' || c.field === 'status') {
          await db.query(
            `insert into ${T('friend_status_history')} (user_id, status, description, at) values (?,?,?,?)`,
            [uid, next.status ?? null, next.status_description ?? null, at],
          );
        }
        if (c.field === 'avatar_id') {
          await db.query(
            `insert into ${T('friend_avatar_history')} (user_id, kind, value, at) values (?,?,?,?)`,
            [uid, 'avatar', c.new, at],
          );
        }
        if (c.field === 'icon_url') {
          await db.query(
            `insert into ${T('friend_avatar_history')} (user_id, kind, value, at) values (?,?,?,?)`,
            [uid, 'icon', c.new, at],
          );
        }
      }
    } catch (e) {
      console.error('[behavior] change history', uid, e.message);
    }
  }
  return { prev, changes, trust };
}

/** 事件落库后按人重算会话与访问区间（失败不影响采集） */
async function refreshBehavior(userId) {
  if (!userId) return;
  try {
    await rebuildUser({ db, T, userId });
  } catch (e) {
    console.error('[behavior] rebuild', userId, e.message);
  }
}

async function logEvent(kind, { userId, displayName, location, worldName, payload }) {
  const wid = worldIdOf(location);
  let wname = worldName ?? null;
  if (wid && !wname) wname = await upsertWorld(wid);
  await db.query(
    `insert into ${T('friend_event')} (user_id, display_name, kind, location, world_id, world_name, payload, at)
     values (?,?,?,?,?,?,?,?)`,
    [userId ?? null, displayName ?? null, kind, location ?? null, wid, wname,
     payload ? JSON.stringify(payload) : null, new Date()],
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

async function handle(type, content) {
  switch (type) {
    case 'friend-online':
    case 'friend-active': {
      const f = friendOf(content);
      await upsertFriend(f);
      await logEvent(type === 'friend-online' ? 'online' : 'active', {
        userId: f.id, displayName: f.displayName, location: f.location,
      });
      await refreshBehavior(f.id);
      break;
    }
    case 'friend-offline': {
      const f = friendOf(content);
      await upsertFriend({ ...f, location: 'offline' });
      await logEvent('offline', { userId: f.id, displayName: f.displayName });
      await refreshBehavior(f.id);
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
      await refreshBehavior(f.id);
      break;
    }
    case 'friend-update': {
      const f = friendOf(content);
      const { changes } = await upsertFriend(f);
      await logEvent('profile', {
        userId: f.id, displayName: f.displayName,
        payload: { changes, fields: Object.keys(content) },
      });
      await refreshBehavior(f.id);
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
        await db.query(`insert into ${T('self_event')} (kind, location, world_id, at) values (?,?,?,?)`,
          [loc === 'offline' ? 'offline' : 'location', loc, worldIdOf(loc), new Date()]);
        if (worldIdOf(loc)) await upsertWorld(worldIdOf(loc));
      }
      break;
    }
    case 'user-update': {
      const u = content.user ?? content;
      await logEvent('self_profile', { userId: u.id, displayName: u.displayName });
      break;
    }
    default: {
      if (type.startsWith('notification')) {
        const n = content.notification ?? content;
        if (n?.id) {
          await db.query(
            `insert into ${T('notification')} (id, type, sender_user_id, message, link, created_at, payload)
             values (?,?,?,?,?,?,?)
             on conflict (id) do nothing`,
            [n.id, n.type ?? type, n.senderUserId ?? null, n.message ?? null, n.link ?? null,
             n.createdAt ?? null, JSON.stringify(n)],
          );
        }
      }
      break;
    }
  }
}

async function seedFriends() {
  const me = await api('/auth/user');
  const ids = (me.friends ?? []).filter((x) => typeof x === 'string');
  let done = 0;
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        await upsertFriend(await api(`/users/${id}`));
      } catch (e) {
        console.error('[seed]', id, e.message);
      }
      done++;
      await new Promise((r) => setTimeout(r, 200));
    }
  }));
  await db.query(
    `insert into ${T('account')} (vrchat_user_id, display_name, last_ok_at) values (?,?,?)
     on conflict (vrchat_user_id) do update set display_name = excluded.display_name, last_ok_at = excluded.last_ok_at`,
    [me.id, me.displayName, new Date()],
  );
  console.log(`[seed] ${done}/${ids.length} friends, me=${me.displayName}`);
  return me;
}

async function resolveWorlds() {
  try {
    const rows = await db.query(
      `select distinct f.world_id from ${T('friend')} f
        left join ${T('world')} w on w.id = f.world_id
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
    lastMsgTs = Date.now();
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    console.log(new Date().toISOString(), 'msg', m.type);
    if (['friend-offline', 'friend-online', 'friend-location', 'friend-update'].includes(m.type)) {
      try {
        fs.appendFileSync('/tmp/vrc-raw-events.jsonl',
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
    if (code === 4001 || code === 4003 || code === 4004) {
      // 鉴权类关闭：先刷新 cookie，否则重连还是立刻被踢
      try { await relogin(); } catch (e) { console.error('[auth] 刷新失败', e.message); }
    }
    await touchState({ connected: false, last_error: `closed ${code}` });
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  });

  ws.on('error', (e) => console.error('[ws] error', e.message));
  ws.on('unexpected-response', (_req, res) => console.error('[ws] http', res.statusCode));
}

async function main() {
  await seedFriends();
  await resolveWorlds();
  setInterval(resolveWorlds, 120_000).unref();
  setInterval(() => seedFriends().catch((e) => console.error('[seed]', e.message)), 3_600_000).unref();
  await connect();
  setInterval(() => {
    if (!ws || ws.readyState !== WS.OPEN) return;
    try { ws.ping(); } catch { /* ignore */ }
  }, 30_000);
  setInterval(() => {
    if (ws && ws.readyState === WS.OPEN && Date.now() - lastMsgTs > 600_000) {
      console.warn('[ws] silent for 10min, reconnecting');
      try { ws.terminate(); } catch { /* ignore */ }
    }
  }, 60_000).unref();
  setInterval(async () => {
    const open = !!ws && ws.readyState === WS.OPEN;
    try { await touchState({ connected: open, msg_count: msgCount }); } catch (e) { console.error('[heartbeat]', e.message); }
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
