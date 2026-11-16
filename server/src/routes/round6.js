/**
 * 第六轮 C 段（信息架构）：三个「已有数据、只缺查询」的接口。
 *
 *   73 /api/friend-log   全好友流水（friend_event + friend_change + friend_status_history 合并）
 *   74 /api/game-log     自己的进出实例明细（game_event）
 *   75 /api/friend-list  好友全量表（信任等级 / 标签 / 收藏筛选 + 最后在线）
 *
 * 只读：全部是 select，不写库、不碰 VRChat。聚合与排序在 JS 里做，PG / SQLite 结果一致。
 */

const HOUR = 3600_000;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const num = (v) => (v === null || v === undefined ? null : Number(v));
const isoOf = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v));

/** jsonb 在 PG 是对象、SQLite 是 TEXT，统一解析失败就返回 null */
const parseJson = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return null; }
};

/** 'wrld_xxx:123~region(jp)' → { world_id, instance } */
const splitLocation = (loc) => {
  const s = String(loc ?? '');
  if (!s) return { world_id: null, instance: null };
  const i = s.indexOf(':');
  return i < 0 ? { world_id: s, instance: null } : { world_id: s.slice(0, i), instance: s.slice(i + 1) };
};

const TRUST_RANK = {
  'system_trust_visitor': 1,
  'system_trust_new_user': 1,
  'system_trust_basic': 2,
  'system_trust_known': 3,
  'system_trust_trusted': 4,
  'system_trust_veteran': 4,
  'system_trust_intermediate': 4,
};

export function registerRound6Routes(app, { db, T, iso }) {
  const at = (v) => (v === null || v === undefined ? null : isoOf(iso(v)));

  /* ───────── 73 好友历史：跨好友汇总流水 ───────── */
  app.get('/api/friend-log', async (req) => {
    const hours = clamp(Number(req.query.hours ?? 24) || 24, 1, 24 * 30);
    const limit = clamp(Number(req.query.limit ?? 300) || 300, 1, 1000);
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    const wantKind = req.query.kind ? String(req.query.kind) : null;
    const since = req.query.since ? String(req.query.since) : new Date(Date.now() - hours * HOUR).toISOString();

    const userWhere = userId ? 'and e.user_id = ?' : '';
    const p = userId ? [since, userId] : [since];

    const events = await db.query(
      `select e.id, e.user_id, coalesce(e.display_name, f.display_name) as display_name,
              f.icon_url, e.kind, e.location, e.world_id,
              coalesce(e.world_name, w.name) as world_name, e.at
         from ${T('friend_event')} e
         left join ${T('friend')} f on f.user_id = e.user_id
         left join ${T('world')} w on w.id = e.world_id
        where e.at >= ? ${userWhere}
        order by e.at desc limit ?`,
      [...p, limit],
    );
    const changes = await db.query(
      `select c.id, c.user_id, f.display_name, f.icon_url, c.field, c.old_value, c.new_value, c.at
         from ${T('friend_change')} c
         left join ${T('friend')} f on f.user_id = c.user_id
        where c.at >= ? ${userId ? 'and c.user_id = ?' : ''}
        order by c.at desc limit ?`,
      [...p, limit],
    );
    const statuses = await db.query(
      `select s.id, s.user_id, f.display_name, f.icon_url, s.status, s.description, s.at
         from ${T('friend_status_history')} s
         left join ${T('friend')} f on f.user_id = s.user_id
        where s.at >= ? ${userId ? 'and s.user_id = ?' : ''}
        order by s.at desc limit ?`,
      [...p, limit],
    );

    const items = [];
    for (const r of events) {
      const loc = r.location ?? null;
      let text = r.world_name ?? (loc && !['offline', 'private', 'traveling'].includes(loc) ? '未知世界' : null);
      if (loc === 'offline') text = '下线';
      if (loc === 'private') text = '私密世界';
      if (loc === 'traveling') text = '切换中';
      if (r.kind === 'online') text = text ?? '上线';
      items.push({
        id: `ev-${r.id}`,
        src: 'event',
        kind: r.kind,
        user_id: r.user_id,
        display_name: r.display_name,
        icon_url: r.icon_url ?? null,
        world_name: r.world_name ?? null,
        location: loc,
        text,
        at: at(r.at),
      });
    }
    for (const r of changes) {
      items.push({
        id: `ch-${r.id}`,
        src: 'change',
        kind: 'profile',
        user_id: r.user_id,
        display_name: r.display_name,
        icon_url: r.icon_url ?? null,
        world_name: null,
        location: null,
        field: r.field,
        text: `${r.field}：${r.old_value ?? '空'} → ${r.new_value ?? '空'}`,
        at: at(r.at),
      });
    }
    for (const r of statuses) {
      items.push({
        id: `st-${r.id}`,
        src: 'status',
        kind: 'status',
        user_id: r.user_id,
        display_name: r.display_name,
        icon_url: r.icon_url ?? null,
        world_name: null,
        location: null,
        status: r.status ?? null,
        text: r.description ? `「${r.description}」` : r.status ?? null,
        at: at(r.at),
      });
    }

    const filtered = wantKind ? items.filter((i) => i.kind === wantKind) : items;
    filtered.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const items2 = filtered.slice(0, limit);
    const counts = {};
    for (const i of filtered) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
    return {
      since,
      hours,
      returned: items2.length,
      total: filtered.length,
      counts,
      people: new Set(items.map((i) => i.user_id).filter(Boolean)).size,
      items: items2,
    };
  });

  /* ───────── 74 游戏日志：自己进出实例明细 ───────── */
  app.get('/api/game-log', async (req) => {
    const limit = clamp(Number(req.query.limit ?? 200) || 200, 1, 1000);
    const world = req.query.world ? String(req.query.world) : null; // 世界 id 或名字片段
    const kind = req.query.kind ? String(req.query.kind) : null;
    const since = req.query.since ? String(req.query.since) : null;

    const where = [];
    const params = [];
    if (since) { where.push('at >= ?'); params.push(since); }
    if (kind) { where.push('kind = ?'); params.push(kind); }
    if (world) {
      // game_event 没有独立 world_id 列：世界 id 在 location 前缀里（wrld_xxx:instance）
      where.push('(location = ? or location like ? or world_name like ?)');
      params.push(world, `${world}:%`, `%${world}%`);
    }
    const rows = await db.query(
      `select id, kind, display_name, user_id, location, world_name, detail, at
         from ${T('game_event')}
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by at desc limit ?`,
      [...params, limit],
    );

    const items = rows.map((r) => {
      const d = parseJson(r.detail) ?? {};
      const { world_id, instance } = splitLocation(r.location ?? d.location);
      return {
        id: num(r.id),
        kind: r.kind,
        at: at(r.at),
        world_id: d.world_id ?? world_id ?? null,
        world_name: r.world_name ?? d.world_name ?? null,
        instance,
        location: r.location ?? null,
        players: Array.isArray(d.players) ? d.players : null,
        detail: d,
      };
    });
    // 真实数据里 world_id 常为空（只有 world_name），统计要按两者之一去重，否则永远 0
    const worlds = new Set(items.map((i) => i.world_id ?? i.world_name).filter(Boolean));
    return { returned: items.length, kind, world, worlds: worlds.size, items };
  });

  /* ───────── 75 好友列表：全量 + 信任等级 / 标签 / 收藏筛选 ───────── */
  app.get('/api/friend-list', async (req) => {
    const q = req.query.q ? String(req.query.q).toLowerCase() : null;
    const trust = req.query.trust ? String(req.query.trust) : null; // 等级名或 rank 数字
    const tag = req.query.tag ? String(req.query.tag) : null;
    const favorite = req.query.favorite === '1' || req.query.favorite === 'true';
    const sort = String(req.query.sort ?? 'last_seen');
    const limit = clamp(Number(req.query.limit ?? 500) || 500, 1, 2000);

    const rows = await db.query(
      `select user_id, display_name, trust_level, trust_rank, platform, status, status_description,
              location, world_id, world_name, icon_url, is_favorite, updated_at
         from ${T('friend')}`,
    );
    const tagRows = await db.query(`select user_id, tag from ${T('friend_tag')} order by tag`);
    const sessRows = await db.query(
      `select user_id, max(coalesce(ended_at, started_at)) as last_at from ${T('friend_session')}
        group by user_id`,
    );
    const noteRows = await db.query(`select user_id, note from ${T('friend_note')}`);

    const tags = new Map();
    for (const r of tagRows) {
      if (!tags.has(r.user_id)) tags.set(r.user_id, []);
      tags.get(r.user_id).push(r.tag);
    }
    const lastSeen = new Map(sessRows.map((r) => [r.user_id, at(r.last_at)]));
    const notes = new Map(noteRows.map((r) => [r.user_id, r.note]));
    const ONLINE = (loc) => loc && !['offline', 'private', 'traveling'].includes(loc);

    let friends = rows.map((r) => {
      const rank = num(r.trust_rank) ?? TRUST_RANK[r.trust_level] ?? null;
      const online = ONLINE(r.location);
      return {
        user_id: r.user_id,
        display_name: r.display_name ?? r.user_id,
        trust_level: r.trust_level ?? null,
        trust_rank: rank,
        platform: r.platform ?? null,
        status: r.status ?? null,
        status_description: r.status_description ?? null,
        online: !!online,
        location: r.location ?? null,
        world_id: r.world_id ?? null,
        world_name: r.world_name ?? null,
        icon_url: r.icon_url ?? null,
        favorite: !!Number(r.is_favorite),
        tags: tags.get(r.user_id) ?? [],
        note: notes.get(r.user_id) ?? null,
        // 在线的人「最后在线」就是现在（friend.updated_at 是这次状态的心跳）
        last_seen: online ? at(r.updated_at) ?? lastSeen.get(r.user_id) ?? null : lastSeen.get(r.user_id) ?? null,
      };
    });

    if (q) friends = friends.filter((f) => f.display_name.toLowerCase().includes(q) || f.user_id.includes(q));
    if (tag) friends = friends.filter((f) => f.tags.includes(tag));
    if (favorite) friends = friends.filter((f) => f.favorite);
    if (trust) {
      friends = friends.filter((f) => (TRUST_RANK[trust] ? f.trust_rank === TRUST_RANK[trust] : String(f.trust_rank ?? '') === trust));
    }

    const sorters = {
      last_seen: (a, b) => (b.last_seen ?? '') .localeCompare(a.last_seen ?? ''),
      name: (a, b) => a.display_name.localeCompare(b.display_name, 'zh-CN'),
      trust: (a, b) => (b.trust_rank ?? 0) - (a.trust_rank ?? 0) || a.display_name.localeCompare(b.display_name, 'zh-CN'),
    };
    friends.sort(sorters[sort] ?? sorters.last_seen);

    const allTags = [...new Set(tagRows.map((r) => r.tag))];
    return {
      total: rows.length,
      returned: Math.min(friends.length, limit),
      filters: { q, trust, tag, favorite, sort },
      online: friends.filter((f) => f.online).length,
      tags: allTags,
      friends: friends.slice(0, limit),
    };
  });
}
