/**
 * 第二轮：全局搜索 / 世界详情 / 好友详情 / CSV 导出 / 通知已读。
 * SQL 只写 `?`，由 db 适配层翻方言；时间一律 ISO 字符串比较。
 */
/** 56：tags 在库里是 JSON 文本，读出来统一成数组 */
function parseTags(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const j = JSON.parse(v);
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

import { matchText } from '../lib/pinyin.js';

/**
 * 搜索热缓存：三份全量列表（好友/世界/同房玩家）60 秒重建一次，
 * 搜索只在这份内存数据上过滤。原来每次请求都 select limit 2000 再 JS 过滤，
 * 首屏 1.7 秒；缓存后稳定在几毫秒。
 */
const CACHE_TTL_MS = 60_000;
let searchCache = { at: 0, friends: [], worlds: [], players: [] };

export function registerRound2Routes(app, { db, T, iso }) {
  const ONLINE = `location is not null and location not in ('offline','private','traveling')`;
  /** 105 拼音搜索在 JS 里过滤，线上判断用同一套语义 */
  const ONLINE_TEST = (f) => !!f.location && !['offline', 'private', 'traveling'].includes(String(f.location));

  /** 重建搜索热缓存（好友 / 世界 / 同房玩家），60 秒一次 */
  async function rebuildSearchCache() {
    const [friends, worlds, rows] = await Promise.all([
      db.query(`select user_id, display_name, icon_url, status, location, world_id, world_name from ${T('friend')}`),
      db.query(`select id, name, author_name, thumbnail from ${T('world')}`),
      db.query(`select display_name, user_id, world_name, at from ${T('game_event')} where kind = 'room_join' order by at desc limit 5000`),
    ]);
    const map = new Map();
    for (const r of rows) {
      const key = r.user_id ?? r.display_name;
      if (!key) continue;
      const cur = map.get(key);
      if (cur) {
        cur.meets += 1;
        if (r.world_name && cur.worlds.length < 5 && !cur.worlds.includes(r.world_name)) cur.worlds.push(r.world_name);
      } else {
        map.set(key, {
          name: r.display_name ?? r.user_id,
          user_id: r.user_id ?? null,
          meets: 1,
          last_seen: iso(r.at),
          worlds: r.world_name ? [r.world_name] : [],
        });
      }
    }
    searchCache = {
      at: Date.now(),
      friends: friends.slice(),
      worlds: worlds.slice(),
      players: [...map.values()].sort((a, b) => b.meets - a.meets),
    };
    return searchCache;
  }

  // 启动即预热，之后每 60 秒后台刷新：第一个搜索请求不用等建缓存
  rebuildSearchCache().catch(() => {});
  const warm = setInterval(() => { rebuildSearchCache().catch(() => {}); }, CACHE_TTL_MS);
  if (typeof warm.unref === 'function') warm.unref();

  /** 21 全局搜索：好友 / 世界 / 同房玩家，各取前 limit 条（111 独立搜索页） */
  app.get('/api/search', async (req) => {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit ?? 8) || 8, 1), 50);
    if (!q) return { q, friends: [], worlds: [], players: [], counts: { friends: 0, worlds: 0, players: 0 }, total: 0 };
    // 冷启动/刚写入时缓存可能还是空的（预热早于采集入库），先补建再过滤，
    // 否则部署后头 60 秒搜索全空
    if (!searchCache.friends.length && !searchCache.worlds.length) await rebuildSearchCache();
    else if (Date.now() - searchCache.at > CACHE_TTL_MS * 3) await rebuildSearchCache();

    const friendsAll = searchCache.friends
      .filter((f) => matchText(f.display_name, q))
      .sort((a, b) => (ONLINE_TEST(a) === ONLINE_TEST(b) ? 0 : ONLINE_TEST(a) ? -1 : 1));
    const worldsAll = searchCache.worlds.filter((w) => matchText(w.name, q) || matchText(w.author_name, q));
    const playersAll = searchCache.players.filter((p) => matchText(p.name, q));

    const friends = friendsAll.slice(0, limit);
    const worlds = worldsAll.slice(0, limit);
    const players = playersAll.slice(0, limit);
    const counts = { friends: friendsAll.length, worlds: worldsAll.length, players: playersAll.length };
    return { q, friends, worlds, players, counts, total: counts.friends + counts.worlds + counts.players };
  });

  /** 22 世界详情：作者 / 容量 / 在线好友 / 我去过几次 */
  app.get('/api/world/:id', async (req, reply) => {
    const id = String(req.params.id);
    let [w] = await db.query(
      `select id, name, author_id, author_name, capacity, thumbnail, updated_at,
              visits_total, favorites, popularity
         from ${T('world')} where id = ?`,
      [id],
    );
    if (!w) {
      // 只在事件里出现过的世界：用事件里的名字凑一个最小档案
      const [e] = await db.query(
        `select world_name as name from ${T('friend_event')} where world_id = ? and world_name is not null limit 1`,
        [id],
      );
      if (!e?.name) return reply.code(404).send({ ok: false, error: '没有这个世界' });
      w = { id, name: e.name, author_id: null, author_name: null, capacity: null, thumbnail: null, updated_at: null, visits_total: null, favorites: null, popularity: null };
    }

    const onlineFriends = await db.query(
      `select user_id, display_name, icon_url, status from ${T('friend')}
        where world_id = ? and ${ONLINE} order by display_name`,
      [id],
    );
    // 我的到访：self_event 里指向这个世界的 location 事件，相邻两条配停留时长
    const mine = await db.query(
      `select at from ${T('self_event')} where world_id = ? and kind = 'location' order by at`,
      [id],
    );
    const stops = mine.map((r, i) => ({
      at: iso(r.at),
      minutes: i + 1 < mine.length
        ? Math.round((new Date(iso(mine[i + 1].at)) - new Date(iso(r.at))) / 60000)
        : null,
    }));
    const minutes = stops.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
    const [fav] = await db.query(
      `select id, note, pinned from ${T('favorite')} where kind = 'world' and target_id = ?`,
      [id],
    );
    const [met] = await db.query(
      `select count(distinct coalesce(user_id, display_name)) as n from ${T('game_event')}
        where kind = 'room_join' and world_name = ?`,
      [w.name],
    );

    /** 106 好友侧到访：这个世界被好友去过多少次 / 去过的人有几个（世界 id 缺失时退回按名字匹配） */
    const [fv] = await db.query(
      `select count(*) as n, count(distinct user_id) as people, min(started_at) as first_at
         from ${T('friend_world_visit')}
        where world_id = ? or (world_id is null and world_name = ?)`,
      [id, w.name],
    );

    /** 35 复制实例链接用：随便取一个当前在这个世界里的好友 location（离线/私密的不算） */
    const [inst] = await db.query(
      `select location from ${T('friend')} where world_id = ? and ${ONLINE}
        order by updated_at desc limit 1`,
      [id],
    ).catch(() => [null]);
    const instance = inst?.location && inst.location.includes(':')
      ? String(inst.location).slice(String(inst.location).indexOf(':') + 1)
      : null;

    return {
      ok: true,
      world: {
        ...w,
        capacity: w.capacity === null ? null : Number(w.capacity),
        visits_total: w.visits_total === null || w.visits_total === undefined ? null : Number(w.visits_total),
        favorites: w.favorites === null || w.favorites === undefined ? null : Number(w.favorites),
        popularity: w.popularity === null || w.popularity === undefined ? null : Number(w.popularity),
        updated_at: w.updated_at ? iso(w.updated_at) : null,
      },
      instance,
      online: onlineFriends.length,
      friends_online_count: onlineFriends.length,
      friends_online: onlineFriends.map((f) => f.display_name ?? f.user_id),
      online_friends: onlineFriends,
      friend_visits: Number(fv?.n ?? 0),
      friends_visited: Number(fv?.people ?? 0),
      friends_first_at: fv?.first_at ? iso(fv.first_at) : null,
      first_at: mine.length ? iso(mine[0].at) : null,
      visits: mine.length,
      minutes,
      last_at: mine.length ? iso(mine[mine.length - 1].at) : null,
      recent: stops.slice(-5).reverse(),
      meets: Number(met?.n ?? 0),
      favorite: fav ? { id: fav.id, note: fav.note ?? null, pinned: !!Number(fav.pinned) } : null,
    };
  });

  /** 23 好友详情：资料 / 最近事件 / 常一起出现的世界 */
  app.get('/api/friend/:id', async (req, reply) => {
    const id = String(req.params.id);
    const [f] = await db.query(
      `select user_id, display_name, trust_level, platform, status, status_description,
              location, world_id, world_name, group_name, avatar_id, icon_url, tags, trust_rank, updated_at
         from ${T('friend')} where user_id = ?`,
      [id],
    );
    const events = await db.query(
      `select id, kind, location, world_id, world_name, at from ${T('friend_event')}
        where user_id = ? order by at desc limit 50`,
      [id],
    );
    if (!f && !events.length) return reply.code(404).send({ ok: false, error: '没有这个好友' });

    const rows = await db.query(
      `select world_id, world_name, location, at from ${T('friend_event')}
        where user_id = ? order by at desc limit 500`,
      [id],
    );
    const byWorld = new Map();
    for (const r of rows) {
      const name = r.world_name ?? (r.location === 'private' ? '私密世界' : null);
      if (!name) continue;
      const cur = byWorld.get(name) ?? { world: name, world_id: r.world_id ?? null, meets: 0, last_seen: iso(r.at) };
      cur.meets += 1;
      byWorld.set(name, cur);
    }
    const [room] = await db.query(
      `select count(*) as n from ${T('game_event')} where kind = 'room_join' and coalesce(user_id, display_name) = ?`,
      [id],
    );
    const worlds = [...byWorld.values()].sort((a, b) => b.meets - a.meets).slice(0, 10);
    // 71 抽屉 Tab 上的数量：一次查完，前端切换 tab 不再多打接口
    const [tabCounts] = await db.query(
      `select (select count(*) from ${T('friend_event')} where user_id = ?) as events,
              (select count(*) from ${T('friend_session')} where user_id = ?) as sessions,
              (select count(distinct coalesce(world_name, world_id)) from ${T('friend_event')}
                where user_id = ? and coalesce(world_name, world_id) is not null) as worlds,
              (select count(*) from ${T('friend_tag')} where user_id = ?) as tags`,
      [id, id, id, id],
    );

    return {
      ok: true,
      counts: {
        events: Number(tabCounts?.events ?? 0),
        sessions: Number(tabCounts?.sessions ?? 0),
        worlds: Number(tabCounts?.worlds ?? 0),
        tags: Number(tabCounts?.tags ?? 0),
      },
      profile: f
        ? {
            ...f,
            updated_at: f.updated_at ? iso(f.updated_at) : null,
            tags: parseTags(f.tags),
            trust_rank: f.trust_rank === null || f.trust_rank === undefined ? null : Number(f.trust_rank),
          }
        : { user_id: id, display_name: events[0]?.display_name ?? id, icon_url: null, location: null },
      events: events.map((e) => ({ ...e, at: iso(e.at) })),
      worlds,
      meets: Number(room?.n ?? 0),
      favorite: null,
    };
  });

  /** 25 CSV 导出：friends / events / players */
  const csvCell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCsv = (cols, rows) =>
    [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

  app.get('/api/export/:name', async (req, reply) => {
    const name = String(req.params.name).replace(/\.csv$/i, '');
    let cols;
    let rows;
    if (name === 'friends') {
      cols = ['user_id', 'display_name', 'status', 'location', 'world_name', 'platform', 'updated_at'];
      rows = (await db.query(
        `select user_id, display_name, status, location, world_name, platform, updated_at
           from ${T('friend')} order by display_name`,
      )).map((r) => ({ ...r, updated_at: iso(r.updated_at) }));
    } else if (name === 'events') {
      cols = ['at', 'kind', 'user_id', 'display_name', 'world_name', 'location'];
      rows = (await db.query(
        `select at, kind, user_id, display_name, world_name, location
           from ${T('friend_event')} order by at desc limit 20000`,
      )).map((r) => ({ ...r, at: iso(r.at) }));
    } else if (name === 'players') {
      cols = ['user_id', 'name', 'meets', 'last_seen', 'worlds'];
      const raw = await db.query(
        `select display_name, user_id, world_name, at from ${T('game_event')}
          where kind = 'room_join' order by at desc limit 20000`,
      );
      const map = new Map();
      for (const r of raw) {
        const key = r.user_id ?? r.display_name;
        const cur = map.get(key) ?? { user_id: r.user_id ?? '', name: r.display_name ?? key, meets: 0, last_seen: iso(r.at), worlds: [] };
        cur.meets += 1;
        if (r.world_name && !cur.worlds.includes(r.world_name)) cur.worlds.push(r.world_name);
        map.set(key, cur);
      }
      rows = [...map.values()]
        .sort((a, b) => b.meets - a.meets)
        .map((r) => ({ ...r, worlds: r.worlds.join(' / ') }));
    } else {
      return reply.code(404).send({ ok: false, error: '不支持的导出' });
    }

    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="vrc-${name}.csv"`);
    return '\ufeff' + toCsv(cols, rows);
  });

  /** 27 通知已读：{ ids: [...] } 或 { all: true } */
  app.post('/api/notifications/read', async (req, reply) => {
    const b = req.body ?? {};
    const ids = Array.isArray(b.ids) ? b.ids.filter((x) => typeof x === 'string').slice(0, 500) : [];
    if (!b.all && !ids.length) return reply.code(400).send({ ok: false, error: '缺 ids 或 all' });
    if (b.all) {
      const before = await db.query(`select id from ${T('notification')} where seen = ?`, [false]);
      await db.query(`update ${T('notification')} set seen = ? where seen = ?`, [true, false]);
      return { ok: true, updated: before.length };
    }
    let updated = 0;
    for (const id of ids) {
      const [hit] = await db.query(`select id from ${T('notification')} where id = ? and seen = ?`, [id, false]);
      if (!hit) continue;
      await db.query(`update ${T('notification')} set seen = ? where id = ?`, [true, id]);
      updated += 1;
    }
    return { ok: true, updated };
  });

  return null;
}
