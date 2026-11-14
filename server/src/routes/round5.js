/**
 * 第五轮：好友行为数据沉淀（51~58）。
 *
 * 数据来源：
 *   friend_session / friend_world_visit  ← lib/behavior.js 从 friend_event 推导（历史回填 + 实时重算）
 *   friend_change / friend_status_history / friend_avatar_history ← 采集器 upsertFriend 时写入
 *   notification  ← pipeline 通知存档（55，查询在 /api/notifications?kind=）
 *
 * 所有聚合在 JS 里做，PG / SQLite 结果一致；时间切分统一 +08:00。
 */

const TZ = 8 * 3600_000;
const HOUR = 3600_000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const num = (v) => (v === null || v === undefined ? null : Number(v));

/** 事件 / 会话的时间统一成 ISO 字符串 */
const isoOf = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v));

export function registerRound5Routes(app, { db, T, iso }) {
  const at = (v) => (v === null || v === undefined ? null : isoOf(iso(v)));

  /** 51 会话列表：好友每次在线一段，含时长/世界/当时状态 */
  app.get('/api/friend/:id/sessions', async (req) => {
    const id = String(req.params.id);
    const limit = clamp(Number(req.query.limit ?? 100) || 100, 1, 500);
    const since = req.query.since ? String(req.query.since) : null;
    const rows = await db.query(
      `select id, started_at, ended_at, minutes, location, world_id, world_name, status
         from ${T('friend_session')} where user_id = ? ${since ? 'and started_at >= ?' : ''}
        order by started_at desc limit ?`,
      since ? [id, since, limit] : [id, limit],
    );
    const sessions = rows.map((r) => ({
      ...r,
      started_at: at(r.started_at),
      ended_at: at(r.ended_at),
      minutes: num(r.minutes),
      ongoing: !r.ended_at,
      world: r.world_name ?? (r.location === 'private' ? '私密世界' : r.world_id),
    }));
    const totalMinutes = sessions.reduce((a, s) => a + (s.minutes ?? 0), 0);
    return {
      user_id: id,
      returned: sessions.length,
      total_minutes: totalMinutes,
      ongoing: sessions.some((s) => s.ongoing),
      sessions,
    };
  });

  /** 52 世界访问：按次数排序，附带总时长 / 最近一次 */
  app.get('/api/friend/:id/worlds', async (req) => {
    const id = String(req.params.id);
    const rows = await db.query(
      `select world_id, world_name, started_at, ended_at, minutes
         from ${T('friend_world_visit')} where user_id = ? and world_id is not null
        order by started_at asc`,
      [id],
    );
    const names = new Map();
    try {
      for (const w of await db.query(`select id, name from ${T('world')}`)) names.set(w.id, w.name);
    } catch { /* world 表异常不影响 */ }

    const map = new Map();
    for (const r of rows) {
      const key = r.world_id;
      const cur = map.get(key) ?? {
        world_id: key,
        world_name: names.get(key) ?? r.world_name ?? key,
        visits: 0,
        minutes: 0,
        first_at: at(r.started_at),
        last_at: at(r.started_at),
        last_minutes: null,
      };
      cur.visits += 1;
      cur.minutes += num(r.minutes) ?? 0;
      const s = at(r.started_at);
      if (s < cur.first_at) cur.first_at = s;
      if (s >= cur.last_at) {
        cur.last_at = s;
        cur.last_minutes = num(r.minutes);
        if (r.world_name && (!cur.world_name || cur.world_name === key)) cur.world_name = r.world_name;
      }
      map.set(key, cur);
    }

    const worlds = [...map.values()].sort((a, b) => b.visits - a.visits || (a.last_at < b.last_at ? 1 : -1));
    return { user_id: id, returned: worlds.length, total_visits: worlds.reduce((a, w) => a + w.visits, 0), worlds };
  });

  /** 53 资料变更：字段级 old → new */
  app.get('/api/friend/:id/changes', async (req) => {
    const id = String(req.params.id);
    const limit = clamp(Number(req.query.limit ?? 100) || 100, 1, 500);
    const field = req.query.field ? String(req.query.field) : null;
    const rows = await db.query(
      `select id, field, old_value, new_value, at from ${T('friend_change')}
        where user_id = ? ${field ? 'and field = ?' : ''} order by at desc limit ?`,
      field ? [id, field, limit] : [id, limit],
    );
    return {
      user_id: id,
      returned: rows.length,
      field,
      changes: rows.map((r) => ({
        id: num(r.id),
        field: r.field,
        old: r.old_value ?? null,
        new: r.new_value ?? null,
        at: at(r.at),
      })),
    };
  });

  /** 54 状态消息历史，支持关键词（不区分大小写） */
  app.get('/api/friend/:id/status', async (req) => {
    const id = String(req.params.id);
    const limit = clamp(Number(req.query.limit ?? 100) || 100, 1, 500);
    const q = String(req.query.q ?? '').trim();
    const rows = await db.query(
      `select id, status, description, at from ${T('friend_status_history')}
        where user_id = ?
        ${q ? "and (lower(coalesce(description,'')) like ? or lower(coalesce(status,'')) like ?)" : ''}
        order by at desc limit ?`,
      q ? [id, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, limit] : [id, limit],
    );
    return {
      user_id: id,
      q: q || null,
      returned: rows.length,
      statuses: rows.map((r) => ({ id: num(r.id), status: r.status ?? null, description: r.description ?? null, at: at(r.at) })),
    };
  });

  /** 56 头像 / 立绘历史 + 信任等级（由 tags 的 system_trust_* 解析） */
  app.get('/api/friend/:id/avatars', async (req) => {
    const id = String(req.params.id);
    const limit = clamp(Number(req.query.limit ?? 50) || 50, 1, 200);
    const rows = await db.query(
      `select id, kind, value, at from ${T('friend_avatar_history')}
        where user_id = ? order by at desc limit ?`, [id, limit],
    ).catch(() => []);
    const [f] = await db.query(
      `select user_id, trust_level, trust_rank, tags, avatar_id, icon_url from ${T('friend')} where user_id = ?`, [id],
    ).catch(() => []);
    let tags = [];
    try { tags = f?.tags ? JSON.parse(f.tags) : []; } catch { tags = []; }
    return {
      user_id: id,
      trust: {
        level: f?.trust_level ?? null,
        rank: num(f?.trust_rank),
        tags: Array.isArray(tags) ? tags : [],
      },
      current: { avatar_id: f?.avatar_id ?? null, icon_url: f?.icon_url ?? null },
      returned: rows.length,
      history: rows.map((r) => ({ id: num(r.id), kind: r.kind, value: r.value, at: at(r.at) })),
    };
  });

  /**
   * 57 活跃热力图：7(周几) × 24(小时)，按 +08:00 落格。
   * 优先用会话区间展开（一段在线覆盖多个小时），没有会话时退回在线类事件计数。
   */
  app.get('/api/friend/:id/heatmap', async (req) => {
    const id = String(req.params.id);
    const days = clamp(Number(req.query.days ?? 90) || 90, 1, 365);
    const since = new Date(Date.now() - days * 86400_000).toISOString();

    const sessions = await db.query(
      `select started_at, ended_at from ${T('friend_session')}
        where user_id = ? and started_at >= ? order by started_at`, [id, since],
    ).catch(() => []);

    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let basedOn = 'sessions';
    let spans = 0;

    if (sessions.length) {
      for (const s of sessions) {
        const start = Date.parse(at(s.started_at));
        if (!Number.isFinite(start)) continue;
        const rawEnd = s.ended_at ? Date.parse(at(s.ended_at)) : Date.now();
        // 单段最多记 8 格，避免一次「忘了下线」把整周涂满
        const end = Math.min(Number.isFinite(rawEnd) ? rawEnd : start, start + 8 * HOUR);
        let cursor = Math.floor((start + TZ) / HOUR) * HOUR - TZ;
        spans += 1;
        for (let guard = 0; cursor <= end && guard < 24; guard++) {
          const local = new Date(cursor + TZ);
          matrix[local.getUTCDay()][local.getUTCHours()] += 1;
          cursor += HOUR;
        }
      }
    } else {
      basedOn = 'events';
      const events = await db.query(
        `select at from ${T('friend_event')}
          where user_id = ? and at >= ? and kind in ('online','location','active')`, [id, since],
      ).catch(() => []);
      for (const e of events) {
        const ms = Date.parse(at(e.at));
        if (!Number.isFinite(ms)) continue;
        const local = new Date(ms + TZ);
        matrix[local.getUTCDay()][local.getUTCHours()] += 1;
        spans += 1;
      }
    }

    const total = matrix.flat().reduce((a, b) => a + b, 0);
    let peak = null;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (!peak || matrix[d][h] > peak.n) peak = { weekday: d, hour: h, n: matrix[d][h] };
      }
    }
    return {
      user_id: id,
      tz: '+08:00',
      days,
      based_on: basedOn,
      samples: spans,
      weekdays: WEEKDAYS,
      hourly: matrix,
      max: Math.max(1, ...matrix.flat()),
      total,
      peak: peak && peak.n > 0 ? { ...peak, label: `${WEEKDAYS[peak.weekday]} ${String(peak.hour).padStart(2, '0')}:00` } : null,
    };
  });

  /** 58 统一时间线：事件 / 会话 / 世界访问 / 状态 / 资料变更 混排，时间倒序 */
  app.get('/api/friend/:id/timeline', async (req) => {
    const id = String(req.params.id);
    const limit = clamp(Number(req.query.limit ?? 60) || 60, 1, 300);
    const since = req.query.since ? String(req.query.since) : null;
    const until = req.query.until ? String(req.query.until) : null;
    const win = (col) => {
      const w = [];
      if (since) w.push(`${col} >= ?`);
      if (until) w.push(`${col} < ?`);
      return w;
    };

    const evWhere = [`user_id = ?`, ...win('at')];
    const events = await db.query(
      `select id, kind, location, world_id, world_name, at from ${T('friend_event')}
        where ${evWhere.join(' and ')} order by at desc limit ?`,
      [id, ...(since ? [since] : []), ...(until ? [until] : []), limit * 3],
    );

    const seWhere = [`user_id = ?`, ...win('started_at')];
    const sessions = await db.query(
      `select id, started_at, ended_at, minutes, world_name, location, status from ${T('friend_session')}
        where ${seWhere.join(' and ')} order by started_at desc limit ?`,
      [id, ...(since ? [since] : []), ...(until ? [until] : []), limit * 2],
    ).catch(() => []);

    const viWhere = [`user_id = ?`, ...win('started_at')];
    const visits = await db.query(
      `select id, world_id, world_name, started_at, ended_at, minutes from ${T('friend_world_visit')}
        where ${viWhere.join(' and ')} order by started_at desc limit ?`,
      [id, ...(since ? [since] : []), ...(until ? [until] : []), limit * 2],
    ).catch(() => []);

    const stWhere = [`user_id = ?`, ...win('at')];
    const statuses = await db.query(
      `select id, status, description, at from ${T('friend_status_history')}
        where ${stWhere.join(' and ')} order by at desc limit ?`,
      [id, ...(since ? [since] : []), ...(until ? [until] : []), limit],
    ).catch(() => []);

    const chWhere = [`user_id = ?`, ...win('at')];
    const changes = await db.query(
      `select id, field, old_value, new_value, at from ${T('friend_change')}
        where ${chWhere.join(' and ')} order by at desc limit ?`,
      [id, ...(since ? [since] : []), ...(until ? [until] : []), limit],
    ).catch(() => []);

    const items = [
      ...events.map((r) => ({
        type: 'event', at: at(r.at), kind: r.kind,
        world: r.world_name ?? (r.location === 'private' ? '私密世界' : r.world_id),
        location: r.location ?? null,
      })),
      ...sessions.map((r) => ({
        type: 'session', at: at(r.started_at), ended_at: at(r.ended_at), minutes: num(r.minutes),
        world: r.world_name ?? (r.location === 'private' ? '私密世界' : null),
        status: r.status ?? null, ongoing: !r.ended_at,
      })),
      ...visits.map((r) => ({
        type: 'visit', at: at(r.started_at), ended_at: at(r.ended_at), minutes: num(r.minutes),
        world_id: r.world_id, world: r.world_name ?? r.world_id,
      })),
      ...statuses.map((r) => ({
        type: 'status', at: at(r.at), status: r.status ?? null, description: r.description ?? null,
      })),
      ...changes.map((r) => ({
        type: 'change', at: at(r.at), field: r.field, old: r.old_value ?? null, new: r.new_value ?? null,
      })),
    ].filter((x) => x.at && (!since || x.at >= since) && (!until || x.at < until));

    items.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1));
    return {
      user_id: id,
      since: since ?? null,
      until: until ?? null,
      returned: Math.min(items.length, limit),
      has_more: items.length > limit,
      counts: {
        event: events.length, session: sessions.length, visit: visits.length,
        status: statuses.length, change: changes.length,
      },
      items: items.slice(0, limit),
    };
  });

  return null;
}
