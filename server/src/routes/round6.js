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

/** VRChat 好友 tags 里的 language_xxx → 显示名（只认截图/官方标签里出现的语言码） */
const LANG_LABEL = {
  eng: 'English', jpn: '日本語', zho: '中文', kor: '한국어', fra: 'Français',
  deu: 'Deutsch', spa: 'Español', por: 'Português', rus: 'Русский', ita: 'Italiano',
  tha: 'ไทย', vie: 'Tiếng Việt', ind: 'Bahasa', pol: 'Polski', nld: 'Nederlands',
  swe: 'Svenska', dan: 'Dansk', nor: 'Norsk', ces: 'Čeština', tur: 'Türkçe',
  ukr: 'Українська', hun: 'Magyar', ron: 'Română', ell: 'Ελληνικά', heb: 'עברית',
  ara: 'العربية', hin: 'हिन्दी', fil: 'Filipino',
};
const languageOf = (tags) => {
  const list = Array.isArray(tags) ? tags : parseJson(tags);
  const code = (Array.isArray(list) ? list : []).map((t) => String(t).match(/^language_([a-z]{3})$/)).find(Boolean);
  return code ? LANG_LABEL[code[1]] ?? code[1] : null;
};

/** self_event 的 location 行 → 我自己的停留区间（同 round7 的 myIntervals，按世界分组便于求交） */
function myIntervalsByWorld(rows, now) {
  const byWorld = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.kind !== 'location') continue;
    const loc = String(r.location ?? '');
    const world_id = splitLocation(loc).world_id;
    if (!world_id || !/^wrld_/.test(world_id)) continue;
    const start = new Date(isoOf(r.at)).getTime();
    const next = rows[i + 1];
    const end = next ? new Date(isoOf(next.at)).getTime() : now;
    if (!(end > start)) continue;
    if (!byWorld.has(world_id)) byWorld.set(world_id, []);
    byWorld.get(world_id).push({ start, end });
  }
  return byWorld;
}

const overlapMs = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

export function registerRound6Routes(app, { db, T, iso }) {
  const at = (v) => (v === null || v === undefined ? null : isoOf(iso(v)));

  /* ───────── 73 好友历史：跨好友汇总流水 ───────── */
  app.get('/api/friend-log', async (req) => {
    const hours = clamp(Number(req.query.hours ?? 24) || 24, 1, 24 * 30);
    const limit = clamp(Number(req.query.limit ?? 100) || 100, 1, 1000);
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    // kinds=a,b（多选）；老的 kind=a 继续收，单值等价于一项
    const rawKinds = String(req.query.kinds ?? req.query.kind ?? '')
      .split(',').map((x) => x.trim()).filter(Boolean);
    const wantKinds = rawKinds.length ? new Set(rawKinds) : null;
    const since = req.query.since ? String(req.query.since) : new Date(Date.now() - hours * HOUR).toISOString();
    // 游标 = 上一页最后一条的 `at|id`：新事件插到头上也不会让翻页重复（offset 会）
    const [cAt, cId] = String(req.query.cursor ?? '').split('|');
    const cursor = cAt ? { at: cAt, id: cId ?? '' } : null;

    const EVENT_KINDS = ['online', 'offline', 'location'];
    const eventKinds = wantKinds ? EVENT_KINDS.filter((k) => wantKinds.has(k)) : null;
    const wantEvents = !wantKinds || eventKinds.length > 0;
    const wantProfile = !wantKinds || wantKinds.has('profile');
    const wantStatus = !wantKinds || wantKinds.has('status');

    /** 时间窗 + 人 + 游标，三张表共用同一套条件；计数/人数用 withCursor:false（总数不随翻页缩水） */
    const win = (alias, { withCursor = true } = {}) => {
      const w = [`${alias}.at >= ?`];
      const v = [since];
      if (userId) { w.push(`${alias}.user_id = ?`); v.push(userId); }
      if (cursor && withCursor) { w.push(`${alias}.at <= ?`); v.push(cursor.at); }
      return { sql: w.join(' and '), v };
    };
    const ew = win('e');
    const cw = win('c');
    const sw = win('s');
    if (eventKinds) {
      ew.sql += ` and e.kind in (${eventKinds.map(() => '?').join(',')})`;
      ew.v.push(...eventKinds);
    }

    const n = limit + 1; // 多取一条判断 has_more
    const events = wantEvents ? await db.query(
      `select e.id, e.user_id, coalesce(e.display_name, f.display_name) as display_name,
              f.icon_url, e.kind, e.location, e.world_id,
              coalesce(e.world_name, w.name) as world_name, e.at
         from ${T('friend_event')} e
         left join ${T('friend')} f on f.user_id = e.user_id
         left join ${T('world')} w on w.id = e.world_id
        where ${ew.sql}
        order by e.at desc limit ?`,
      [...ew.v, n],
    ) : [];
    const changes = wantProfile ? await db.query(
      `select c.id, c.user_id, f.display_name, f.icon_url, c.field, c.old_value, c.new_value, c.at
         from ${T('friend_change')} c
         left join ${T('friend')} f on f.user_id = c.user_id
        where ${cw.sql}
        order by c.at desc limit ?`,
      [...cw.v, n],
    ) : [];
    const statuses = wantStatus ? await db.query(
      `select s.id, s.user_id, f.display_name, f.icon_url, s.status, s.description, s.at
         from ${T('friend_status_history')} s
         left join ${T('friend')} f on f.user_id = s.user_id
        where ${sw.sql}
        order by s.at desc limit ?`,
      [...sw.v, n],
    ) : [];

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

    // 倒序（同秒按 id 兜底，保证翻页有全序）；游标之前/同秒已返回的丢掉
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    const after = cursor
      ? items.filter((i) => i.at < cursor.at || (i.at === cursor.at && i.id < cursor.id))
      : items;
    const page = after.slice(0, limit);
    const nextCursor = after.length > limit ? `${page[page.length - 1]?.at}|${page[page.length - 1]?.id}` : null;

    // 计数按「时间窗 + 人」，不受类型多选 / 游标影响，筛选按钮上的数字才是全量
    const cnt = (rows) => rows.reduce((m, r) => { m[r.kind] = Number(r.n); return m; }, {});
    const cEv = win('e', { withCursor: false });
    const cCh = win('c', { withCursor: false });
    const cSt = win('s', { withCursor: false });
    const evCounts = cnt(await db.query(
      `select e.kind as kind, count(*) as n from ${T('friend_event')} e where ${cEv.sql} group by e.kind`,
      cEv.v,
    ));
    const chCounts = cnt(await db.query(
      `select 'profile' as kind, count(*) as n from ${T('friend_change')} c where ${cCh.sql}`,
      cCh.v,
    ));
    const stCounts = cnt(await db.query(
      `select 'status' as kind, count(*) as n from ${T('friend_status_history')} s where ${cSt.sql}`,
      cSt.v,
    ));
    const counts = { ...evCounts, ...chCounts, ...stCounts };
    const total = Object.entries(counts).reduce((s, [k, v]) => s + (wantKinds && !wantKinds.has(k) ? 0 : v), 0);

    const peopleRows = await db.query(
      `select count(distinct user_id) as n from (
         select e.user_id from ${T('friend_event')} e where ${cEv.sql}
         union all
         select c.user_id from ${T('friend_change')} c where ${cCh.sql}
         union all
         select s.user_id from ${T('friend_status_history')} s where ${cSt.sql}
       ) u`,
      [...cEv.v, ...cCh.v, ...cSt.v],
    );

    return {
      since,
      hours,
      kinds: rawKinds,
      returned: page.length,
      total,
      has_more: !!nextCursor,
      next_cursor: nextCursor,
      counts,
      people: Number(peopleRows[0]?.n ?? 0),
      items: page,
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
              location, world_id, world_name, icon_url, avatar_id, tags, is_favorite, updated_at
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

    // 一起玩：自己的停留区间（self_event）与好友的世界到访（friend_world_visit）按世界求交。
    // 没有交集就是 0 —— 宁可显示 0/— 也不拿「好友在线时长」冒充同房时长。
    let visitRows = [];
    let selfRows = [];
    try {
      visitRows = await db.query(
        `select user_id, world_id, started_at, ended_at from ${T('friend_world_visit')} where world_id is not null`,
      );
      selfRows = await db.query(`select kind, location, at from ${T('self_event')} order by at`);
    } catch { /* 老库没这两张表时按 0 显示，不让整页 500 */ }
    const myByWorld = myIntervalsByWorld(selfRows, Date.now());
    const together = new Map();
    for (const v of visitRows) {
      const win = myByWorld.get(v.world_id);
      if (!win) continue;
      const s = new Date(isoOf(v.started_at)).getTime();
      const e = v.ended_at ? new Date(isoOf(v.ended_at)).getTime() : Date.now();
      let ms = 0;
      for (const iv of win) ms += overlapMs(iv.start, iv.end, s, e);
      if (ms <= 0) continue;
      const cur = together.get(v.user_id) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += Math.round(ms / 60000);
      together.set(v.user_id, cur);
    }

    let friends = rows.map((r) => {
      const rank = num(r.trust_rank) ?? TRUST_RANK[r.trust_level] ?? null;
      const online = ONLINE(r.location);
      const inWorld = online && !['active', 'idle'].includes(String(r.location)) && /^wrld_/.test(String(r.location));
      const tg = together.get(r.user_id);
      return {
        user_id: r.user_id,
        display_name: r.display_name ?? r.user_id,
        trust_level: r.trust_level ?? null,
        trust_rank: rank,
        language: languageOf(r.tags),
        avatar_thumb: /^https?:/.test(String(r.avatar_id ?? '')) ? r.avatar_id : null,
        social_links: null, // 未采集 bio links：显示 —，不编造
        together_count: tg?.count ?? 0,
        together_minutes: tg?.minutes ?? 0,
        state_label: inWorld ? '游戏中' : online ? '在线' : '离线',
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
    // 真机好友列表是 20 行/页 + 底部页码（165 条 9 页）；limit 保留给其他调用方
    const pageSize = clamp(Number(req.query.page_size ?? 0) || 0, 0, 500);
    const page = pageSize ? clamp(Number(req.query.page ?? 1) || 1, 1, 9999) : 1;
    const shown = pageSize ? friends.slice((page - 1) * pageSize, page * pageSize) : friends.slice(0, limit);
    return {
      total: rows.length,
      matched: friends.length,
      returned: shown.length,
      page: pageSize ? page : null,
      page_size: pageSize || null,
      pages: pageSize ? Math.max(1, Math.ceil(friends.length / pageSize)) : null,
      filters: { q, trust, tag, favorite, sort },
      online: friends.filter((f) => f.online).length,
      tags: allTags,
      friends: shown,
    };
  });
}
