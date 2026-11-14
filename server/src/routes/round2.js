/**
 * 第二轮：全局搜索 / 世界详情 / 好友详情 / CSV 导出 / 通知已读。
 * SQL 只写 `?`，由 db 适配层翻方言；时间一律 ISO 字符串比较。
 */
export function registerRound2Routes(app, { db, T, iso }) {
  const ONLINE = `location is not null and location not in ('offline','private','traveling')`;

  /** 21 全局搜索：好友 / 世界 / 同房玩家，各取前 8 条 */
  app.get('/api/search', async (req) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return { q, friends: [], worlds: [], players: [], total: 0 };
    const like = `%${q.toLowerCase()}%`;

    const friends = await db.query(
      `select user_id, display_name, icon_url, status, location, world_id, world_name
         from ${T('friend')} where lower(display_name) like ?
        order by case when ${ONLINE} then 0 else 1 end, display_name limit 8`,
      [like],
    );
    const worlds = await db.query(
      `select id, name, author_name, thumbnail from ${T('world')} where lower(name) like ?
        order by name limit 8`,
      [like],
    );
    const rows = await db.query(
      `select display_name, user_id, world_name, at from ${T('game_event')}
        where kind = 'room_join' and lower(display_name) like ? order by at desc limit 200`,
      [like],
    );
    const map = new Map();
    for (const r of rows) {
      const key = r.user_id ?? r.display_name;
      const cur = map.get(key);
      if (cur) {
        cur.meets += 1;
        if (r.world_name && !cur.worlds.includes(r.world_name)) cur.worlds.push(r.world_name);
      } else map.set(key, {
        name: r.display_name ?? r.user_id,
        user_id: r.user_id ?? null,
        meets: 1,
        last_seen: iso(r.at),
        worlds: r.world_name ? [r.world_name] : [],
      });
    }
    const players = [...map.values()].sort((a, b) => b.meets - a.meets).slice(0, 8);
    return { q, friends, worlds, players, total: friends.length + worlds.length + players.length };
  });

  /** 22 世界详情：作者 / 容量 / 在线好友 / 我去过几次 */
  app.get('/api/world/:id', async (req, reply) => {
    const id = String(req.params.id);
    let [w] = await db.query(
      `select id, name, author_id, author_name, capacity, thumbnail, updated_at from ${T('world')} where id = ?`,
      [id],
    );
    if (!w) {
      // 只在事件里出现过的世界：用事件里的名字凑一个最小档案
      const [e] = await db.query(
        `select world_name as name from ${T('friend_event')} where world_id = ? and world_name is not null limit 1`,
        [id],
      );
      if (!e?.name) return reply.code(404).send({ ok: false, error: '没有这个世界' });
      w = { id, name: e.name, author_id: null, author_name: null, capacity: null, thumbnail: null, updated_at: null };
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

    return {
      ok: true,
      world: { ...w, capacity: w.capacity === null ? null : Number(w.capacity), updated_at: w.updated_at ? iso(w.updated_at) : null },
      online: onlineFriends.length,
      online_friends: onlineFriends,
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
              location, world_id, world_name, group_name, avatar_id, icon_url, updated_at
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

    return {
      ok: true,
      profile: f
        ? { ...f, updated_at: f.updated_at ? iso(f.updated_at) : null }
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
