/**
 * 第五轮：好友行为的区间推导（纯函数 + 落库）。
 *
 * friend_event 是「点」（上线 / 换房 / 活跃 / 下线），分析要的是「区间」：
 *   - friend_session      一次在线：started_at → ended_at，minutes，期间在哪
 *   - friend_world_visit  一次停留：进入某世界 → 离开/换房/下线
 *
 * 推导只依赖事件顺序，所以历史（回填）和实时（采集器）走同一份代码，
 * 任意时刻重算结果一致。聚合在 JS 里做，PG / SQLite 行为相同。
 */

const PRESENCE_KINDS = new Set(['online', 'location', 'active', 'in-game', 'friend-online', 'friend-location', 'friend-active']);
const OFFLINE_LOCATIONS = new Set(['offline', 'private', 'traveling']);

export const TRUST_RANKS = [
  ['system_trust_veteran', 4, 'Trusted User'],
  ['system_trust_trusted', 3, 'Known User'],
  ['system_trust_intermediate', 2, 'User'],
  ['system_trust_known', 2, 'User'],
  ['system_trust_basic', 1, 'New User'],
];

/** tags 数组 → { rank, label }：VRChat 用 system_trust_* 表示信任等级 */
export function trustRankOf(tags) {
  if (!Array.isArray(tags)) return { rank: null, label: null };
  for (const [tag, rank, label] of TRUST_RANKS) {
    if (tags.includes(tag)) return { rank, label };
  }
  return { rank: 0, label: 'Visitor' };
}

/** 从 location 拆 world id：wrld_xxx:12345~region(us) → wrld_xxx */
export function worldIdOf(location) {
  if (!location) return null;
  const m = /^(wrld_[0-9a-f-]+)/i.exec(String(location));
  return m ? m[1] : null;
}

const isoAt = (v) => (v instanceof Date ? v.toISOString() : String(v));
const minutesBetween = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

/**
 * 事件 → 区间。events 必须按时间升序。
 * 未闭合的区间（还没下线）ended_at / minutes 为 null，由调用方按需处理。
 */
export function deriveBehavior(events) {
  const sessions = [];
  const visits = [];
  let ses = null;
  let vis = null;

  const closeVisit = (at) => {
    if (!vis) return;
    visits.push({ ...vis, ended_at: at, minutes: minutesBetween(vis.started_at, at) });
    vis = null;
  };
  const closeSession = (at) => {
    closeVisit(at);
    if (!ses) return;
    sessions.push({ ...ses, ended_at: at, minutes: minutesBetween(ses.started_at, at) });
    ses = null;
  };

  for (const e of events) {
    const kind = String(e.kind ?? '');
    const at = isoAt(e.at);
    const loc = e.location ?? null;
    const locText = loc === null ? null : String(loc);
    const offline = kind === 'offline' || locText === 'offline';

    if (offline) { closeSession(at); continue; }
    if (!PRESENCE_KINDS.has(kind)) continue;

    const wid = e.world_id ?? worldIdOf(locText);
    const wname = e.world_name ?? null;

    if (!ses) ses = { started_at: at, location: locText, world_id: wid, world_name: wname };
    else {
      if (locText) ses.location = locText;
      if (wid) { ses.world_id = wid; if (wname) ses.world_name = wname; }
    }

    if (wid) {
      if (!vis || vis.world_id !== wid) {
        closeVisit(at);
        vis = { world_id: wid, world_name: wname, location: locText, started_at: at };
      } else {
        if (locText) vis.location = locText;
        if (wname) vis.world_name = wname;
      }
    } else if (locText && OFFLINE_LOCATIONS.has(locText)) {
      // 私密 / 切换中：会话还在，但不在任何可记录的世界里
      closeVisit(at);
      ses.world_id = null;
      ses.world_name = null;
    }
  }

  // 还没下线的会话/访问也要落库（ended_at=null，页面按"进行中"显示），否则在线的朋友查不到会话
  if (vis) visits.push({ ...vis, ended_at: null, minutes: null });
  if (ses) sessions.push({ ...ses, ended_at: null, minutes: null });

  return { sessions, visits, open: ses ? { ...ses, ended_at: null, minutes: null } : null };
}

/**
 * 按用户重算并落库（先删后插，幂等）。
 * 采集器每收到一条好友事件就调一次；回填脚本对全部用户各调一次。
 */
export async function rebuildUser({ db, T, userId, since = null }) {
  const events = await db.query(
    `select kind, location, world_id, world_name, at from ${T('friend_event')}
      where user_id = ? and kind in ('online','location','offline','active','in-game')
      ${since ? 'and at >= ?' : ''}
      order by at asc`,
    since ? [userId, since] : [userId],
  );
  const { sessions, visits } = deriveBehavior(events);

  let status = null;
  try {
    const [f] = await db.query(`select status from ${T('friend')} where user_id = ?`, [userId]);
    status = f?.status ?? null;
  } catch { /* friend 表异常不影响区间 */ }

  await db.query(`delete from ${T('friend_session')} where user_id = ?`, [userId]);
  await db.query(`delete from ${T('friend_world_visit')} where user_id = ?`, [userId]);

  for (const s of sessions) {
    await db.query(
      `insert into ${T('friend_session')} (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
       values (?,?,?,?,?,?,?,?,?)`,
      [`${userId}|${s.started_at}`, userId, s.started_at, s.ended_at, s.minutes,
       s.location, s.world_id, s.world_name, status],
    );
  }
  for (const v of visits) {
    await db.query(
      `insert into ${T('friend_world_visit')} (id, user_id, world_id, world_name, location, started_at, ended_at, minutes)
       values (?,?,?,?,?,?,?,?)`,
      [`${userId}|${v.world_id}|${v.started_at}`, userId, v.world_id, v.world_name, v.location,
       v.started_at, v.ended_at, v.minutes],
    );
  }
  return { userId, events: events.length, sessions: sessions.length, visits: visits.length };
}

/** 全部好友重算（回填用）。用户多时按批处理，避免一次占满连接。 */
export async function rebuildAll({ db, T, batch = 20 }) {
  const rows = await db.query(`select distinct user_id from ${T('friend_event')} where user_id is not null`);
  const ids = rows.map((r) => r.user_id);
  const out = { users: ids.length, events: 0, sessions: 0, visits: 0, failed: [] };
  for (let i = 0; i < ids.length; i += batch) {
    for (const id of ids.slice(i, i + batch)) {
      try {
        const r = await rebuildUser({ db, T, userId: id });
        out.events += r.events;
        out.sessions += r.sessions;
        out.visits += r.visits;
      } catch (e) {
        out.failed.push({ userId: id, error: e.message });
      }
    }
  }
  return out;
}
