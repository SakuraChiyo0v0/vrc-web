/**
 * 第七轮：按 VRCX-0 真机界面重做结构（docs/vrcx0-parity.md 76~81）。
 *
 *   76/78/79 /api/roster        常驻好友面板 + 顶部筛选标签 + 在线时长/区域徽标
 *   77       /api/overview      「概览」时间范围 + 总时长/对比/每日柱/活跃时段/三块榜单
 *   81       /api/game-log/days 游戏日志：日期 → 世界分组，含起止/时长/同房玩家明细
 *
 * 只读：全是 select。聚合在 JS 里做，PG / SQLite 结果一致。
 * 地域/权限从 location 串里解析：wrld_x:inst~hidden(usr_a)~region(jp)。
 */

const HOUR = 3600_000;
const DAY = 86400_000;
const TZ = 8 * HOUR;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const isoOf = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v));
const parseJson = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return null; }
};

const OFFLINE = new Set(['offline', 'private', 'traveling']);
const isOnline = (loc) => !!loc && !OFFLINE.has(String(loc));

/** location 串 → 世界 / 实例 / 区域 / 访问级别（VRCX-0 右栏显示的「JP 世界名·公开」） */
function parseLocation(loc) {
  const s = String(loc ?? '');
  if (!s) return { world_id: null, instance: null, region: null, access: 'public' };
  const i = s.indexOf(':');
  const world_id = i < 0 ? s : s.slice(0, i);
  const instance = i < 0 ? null : s.slice(i + 1);
  const region = (s.match(/~region\(([^)]+)\)/) || [])[1] ?? null;
  let access = 'public';
  if (/~hidden\(/.test(s)) access = 'friends';
  else if (/~friends\(/.test(s)) access = 'friends+';
  else if (/~group\(/.test(s)) access = 'group';
  return { world_id: /^wrld_/.test(world_id) ? world_id : world_id || null, instance, region, access };
}

const ACCESS_LABEL = { public: '公开', 'friends+': '好友+', friends: '仅好友', group: '群组公开' };

/** +08:00 的日期键 */
const dateKey = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);

/** self_event 的 location 行 → 我自己的停留区间 [{world_id, world_name, start, end, region, access}] */
function myIntervals(rows, now) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind !== 'location') continue;
    const { world_id, region, access } = parseLocation(r.location);
    if (!world_id || !/^wrld_/.test(world_id)) continue;
    const start = new Date(isoOf(r.at)).getTime();
    const next = rows[i + 1];
    const end = next ? new Date(isoOf(next.at)).getTime() : now;
    if (!(end > start)) continue;
    out.push({ world_id, start, end, region, access });
  }
  return out;
}

const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
const minutes = (ms) => Math.max(0, Math.round(ms / 60000));

export function registerRound7Routes(app, { db, T, iso }) {
  const at = (v) => (v === null || v === undefined ? null : isoOf(iso(v)));

  /* ───────── 76/78/79 常驻好友面板：区域 / 在线时长 / 分组计数 ───────── */
  app.get('/api/roster', async (req) => {
    const q = req.query.q ? String(req.query.q).toLowerCase() : null;
    const rows = await db.query(
      `select f.user_id, f.display_name, f.status, f.status_description, f.location,
              f.world_id, coalesce(w.name, f.world_name) as world_name,
              f.platform, f.icon_url, f.is_favorite, f.updated_at
         from ${T('friend')} f left join ${T('world')} w on w.id = f.world_id
        order by f.display_name`,
    );
    // 在线时长：采集器给在线好友开着 friend_session（ended_at 为空）
    let openRows = [];
    try {
      openRows = await db.query(
        `select user_id, max(started_at) as started_at from ${T('friend_session')}
          where ended_at is null group by user_id`,
      );
    } catch { /* 老库没有这张表也不该整页 500 */ }
    const openAt = new Map(openRows.map((r) => [r.user_id, new Date(isoOf(r.started_at)).getTime()]));

    let myLoc = null;
    try {
      const [me] = await db.query(`select location from ${T('self_event')} order by at desc limit 1`);
      myLoc = me?.location ?? null;
    } catch { /* 同上 */ }
    // 'offline'/'private'/'traveling' 是 VRChat 的位置哨兵值，不是世界 ID；
    // VRChat 没在跑时 /api/roster 必须给 null，前端才会落到「VRChat 目前没有运行」空态
    const myWorldRaw = parseLocation(myLoc).world_id;
    const myWorld = myWorldRaw && !OFFLINE.has(myWorldRaw) && /^wrld_/.test(myWorldRaw) ? myWorldRaw : null;
    const now = Date.now();

    let friends = rows.map((r) => {
      const loc = parseLocation(r.location);
      const online = isOnline(r.location);
      const started = openAt.get(r.user_id);
      const onlineMinutes = online && started && started < now ? minutes(now - started) : null;
      return {
        user_id: r.user_id,
        display_name: r.display_name ?? r.user_id,
        status: r.status ?? null,
        status_description: r.status_description ?? null,
        online,
        location: r.location ?? null,
        world_id: r.world_id ?? loc.world_id ?? null,
        world_name: r.world_name ?? null,
        region: loc.region,
        access: loc.access,
        access_label: ACCESS_LABEL[loc.access],
        platform: r.platform ?? null,
        icon_url: r.icon_url ?? null,
        favorite: !!Number(r.is_favorite),
        // 「活跃中」= 状态不是 active 之外的那几个（join me/ask me/busy 也算活跃中）
        active: ['active', 'join me', 'ask me', 'busy'].includes(String(r.status ?? '')),
        same_room: !!myWorld && r.world_id === myWorld && online,
        online_minutes: onlineMinutes,
        updated_at: at(r.updated_at),
      };
    });

    const facets = {
      online: friends.filter((f) => f.online).length,
      favorite: friends.filter((f) => f.favorite).length,
      same_room: friends.filter((f) => f.same_room).length,
      active: friends.filter((f) => f.active).length,
      offline: friends.filter((f) => !f.online).length,
    };
    if (q) friends = friends.filter((f) => f.display_name.toLowerCase().includes(q) || String(f.user_id).includes(q));
    return {
      total: rows.length,
      returned: friends.length,
      my_world_id: myWorld,
      facets,
      groups: [
        { key: 'favorite', label: '已分组的好友', count: facets.favorite },
        { key: 'online', label: '在线', count: facets.online },
        { key: 'same_room', label: '同一房间', count: facets.same_room },
        { key: 'active', label: '活跃中', count: facets.active },
        { key: 'offline', label: '离线', count: facets.offline },
      ],
      friends,
    };
  });

  /* ───────── 77 概览：时间范围 + 总时长/对比 + 每日柱 + 活跃时段 + 三块榜单 ───────── */
  app.get('/api/overview', async (req) => {
    const raw = String(req.query.range ?? 'all');
    const daysWanted = raw === 'all' ? null : clamp(Number(raw) || 0, 1, 3650);
    const now = Date.now();

    const selfRows = await db.query(`select kind, location, world_id, at from ${T('self_event')} order by at`);
    const intervals = myIntervals(selfRows, now);
    const earliest = intervals.length ? Math.min(...intervals.map((i) => i.start)) : now;
    const until = req.query.until ? new Date(String(req.query.until)).getTime() : now;
    const spanDays = daysWanted ?? Math.max(1, Math.ceil((until - earliest) / DAY));
    const since = daysWanted ? until - daysWanted * DAY : earliest;
    const prevSince = since - spanDays * DAY;

    const worldNames = new Map((await db.query(`select id, name from ${T('world')}`)).map((w) => [w.id, w.name]));

    const win = intervals.filter((i) => i.end > since && i.start < until);
    const totalMs = win.reduce((a, i) => a + overlap(i.start, i.end, since, until), 0);
    const prevMs = intervals.reduce((a, i) => a + overlap(i.start, i.end, prevSince, since), 0);

    // 每日时长（+08 切日）
    const daily = new Map();
    for (let t = since - (since % DAY); t < until; t += DAY) daily.set(dateKey(t), 0);
    // 活跃时段：逐小时累加分钟
    const hourly = new Array(24).fill(0);

    let longest = { minutes: 0, world_name: null, at: null };
    let peopleMet = 0;
    for (const iv of win) {
      const s = Math.max(iv.start, since);
      const e = Math.min(iv.end, until);
      const day = dateKey(s);
      if (daily.has(day)) daily.set(day, daily.get(day) + minutes(e - s));
      for (let t = s; t < e; t += HOUR) {
        const h = new Date(t + TZ).getUTCHours();
        hourly[h] += minutes(Math.min(e, t + HOUR) - t);
      }
      if (minutes(e - s) > longest.minutes) {
        longest = { minutes: minutes(e - s), world_id: iv.world_id, world_name: worldNames.get(iv.world_id) ?? iv.world_id, at: new Date(s).toISOString() };
      }
    }

    const hourlyTotal = hourly.reduce((a, b) => a + b, 0);
    const peakHour = hourly.indexOf(Math.max(...hourly));
    const peakPct = hourlyTotal ? Math.round((hourly[peakHour] / hourlyTotal) * 100) : 0;

    // 相处时长：好友会话 ∩ 我的同世界区间
    const sess = await db.query(
      `select s.user_id, s.started_at, s.ended_at, s.world_id, s.world_name, f.display_name
         from ${T('friend_session')} s left join ${T('friend')} f on f.user_id = s.user_id
        where coalesce(s.ended_at, ?) >= ? and s.started_at <= ?
        order by s.started_at`,
      [new Date(until).toISOString(), new Date(Math.min(since, prevSince)).toISOString(), new Date(until).toISOString()],
    );
    const byWorld = new Map();
    for (const iv of intervals) {
      if (!byWorld.has(iv.world_id)) byWorld.set(iv.world_id, []);
      byWorld.get(iv.world_id).push(iv);
    }
    const together = new Map();
    const addTogether = (map, r, from, to) => {
      const rs = new Date(isoOf(r.started_at)).getTime();
      const re = r.ended_at ? new Date(isoOf(r.ended_at)).getTime() : to;
      let ms = 0;
      for (const iv of byWorld.get(r.world_id) ?? []) ms += overlap(rs, re, Math.max(iv.start, from), Math.min(iv.end, to));
      if (!ms) return;
      const cur = map.get(r.user_id) ?? { user_id: r.user_id, name: r.display_name ?? r.user_id, minutes: 0 };
      cur.minutes += minutes(ms);
      map.set(r.user_id, cur);
    };
    const half = since + Math.floor((until - since) / 2);
    const togetherFirst = new Map();
    for (const r of sess) {
      addTogether(together, r, Math.max(since, 0), until);
      addTogether(togetherFirst, r, Math.max(since, 0), half);
    }
    // 第二半 = 总量 - 第一半（逐人）
    const companions = [...together.values()].filter((c) => c.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 8);
    const shrinking = [...together.values()]
      .map((c) => {
        const first = togetherFirst.get(c.user_id)?.minutes ?? 0;
        const second = c.minutes - first;
        return { user_id: c.user_id, name: c.name, minutes: second, was: first, drop: first && first > second ? Math.round((1 - second / first) * 100) : 0 };
      })
      .filter((c) => c.was >= 10 && c.drop > 0)
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 8);

    // 常遇见的过路人：同房过 ≥2 次、且不在好友表里的人
    const joins = await db.query(
      `select display_name, user_id, count(*) as n, max(at) as last_at from ${T('game_event')}
        where kind = 'room_join' and at >= ? and at <= ? group by display_name, user_id`,
      [new Date(since).toISOString(), new Date(until).toISOString()],
    );
    let friendIds = new Set();
    try { friendIds = new Set((await db.query(`select user_id from ${T('friend')}`)).map((r) => r.user_id)); } catch {}
    const met = joins.filter((j) => j.user_id && !friendIds.has(j.user_id));
    peopleMet = new Set(joins.map((j) => j.user_id).filter(Boolean)).size;
    const passersby = met.map((j) => ({ user_id: j.user_id, name: j.display_name ?? j.user_id, meets: Number(j.n), last_at: at(j.last_at) }))
      .filter((p) => p.meets >= 2)
      .sort((a, b) => b.meets - a.meets)
      .slice(0, 8);

    return {
      range: { key: raw, days: spanDays, since: new Date(since).toISOString(), until: new Date(until).toISOString() },
      total_minutes: minutes(totalMs),
      total_hours: Math.round((totalMs / HOUR) * 10) / 10,
      sessions: win.length,
      avg_daily_minutes: minutes(totalMs / Math.max(1, spanDays)),
      longest,
      previous: { minutes: minutes(prevMs), delta_pct: prevMs ? Math.round(((totalMs - prevMs) / prevMs) * 100) : null },
      daily: [...daily.entries()].map(([date, m]) => ({ date, minutes: m })),
      hourly: { buckets: hourly, peak_hour: peakHour, peak_pct: peakPct, total_minutes: hourlyTotal },
      companions,
      shrinking,
      passersby,
      people_met: peopleMet,
    };
  });

  /* ───────── 81 游戏日志：日期 → 世界分组 ───────── */
  app.get('/api/game-log/days', async (req) => {
    const limitDays = clamp(Number(req.query.days ?? 90) || 90, 1, 3650);
    const now = Date.now();
    const since = now - limitDays * DAY;
    const selfRows = await db.query(`select kind, location, world_id, at from ${T('self_event')} order by at`);
    const visits = myIntervals(selfRows, now).filter((iv) => iv.end > since);

    // 同房玩家明细：game_event 的 room_join / room_leave 落在某次停留区间里（按世界名兜底匹配）
    const roomRows = await db.query(
      `select kind, display_name, user_id, world_name, at from ${T('game_event')}
        where kind in ('room_join', 'room_leave') and at >= ? order by at`,
      [new Date(since).toISOString()],
    );
    const joins = roomRows.filter((r) => r.kind === 'room_join');
    const worldNames = new Map((await db.query(`select id, name from ${T('world')}`)).map((w) => [w.id, w.name]));

    const days = new Map();
    let totalMinutes = 0;
    for (const iv of visits) {
      const start = Math.max(iv.start, since);
      const dk = dateKey(start);
      const worldName = worldNames.get(iv.world_id) ?? iv.world_id;
      const inVisit = (j) => {
        const ms = new Date(isoOf(j.at)).getTime();
        return ms >= iv.start && ms <= iv.end && (j.world_name === worldName || j.world_name == null);
      };
      const players = joins
        .filter(inVisit)
        .map((j) => ({ name: j.display_name ?? j.user_id, user_id: j.user_id ?? null, at: at(j.at) }));
      // 94 时间轴：同一停留里按时间排「加入 / 离开」，真机在世界内再分进出
      const events = roomRows
        .filter(inVisit)
        .map((j) => {
          const name = j.display_name ?? j.user_id;
          return { kind: j.kind === 'room_leave' ? 'leave' : 'join', name, user_id: j.user_id ?? null, at: at(j.at) };
        })
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === 'leave' ? -1 : 1));

      if (!days.has(dk)) days.set(dk, { date: dk, minutes: 0, worlds: new Map() });
      const day = days.get(dk);
      const m = minutes(iv.end - start);
      day.minutes += m;
      totalMinutes += m;
      if (!day.worlds.has(iv.world_id)) {
        day.worlds.set(iv.world_id, {
          world_id: iv.world_id, world_name: worldName, minutes: 0,
          region: iv.region ?? null, access: iv.access ?? 'public', access_label: ACCESS_LABEL[iv.access ?? 'public'],
          visits: [],
        });
      }
      const w = day.worlds.get(iv.world_id);
      w.minutes += m;
      w.visits.push({
        start_at: new Date(start).toISOString(),
        end_at: new Date(iv.end).toISOString(),
        minutes: m,
        region: iv.region ?? null,
        access: iv.access ?? 'public',
        access_label: ACCESS_LABEL[iv.access ?? 'public'],
        players,
        events,
        event_count: events.length,
        player_count: players.length,
      });
    }

    const out = [...days.values()]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => ({ ...d, worlds: [...d.worlds.values()].sort((a, b) => b.minutes - a.minutes) }));
    return {
      days: out,
      total_days: out.length,
      total_visits: out.reduce((a, d) => a + d.worlds.reduce((x, w) => x + w.visits.length, 0), 0),
      total_minutes: totalMinutes,
    };
  });
}
