import crypto from 'node:crypto';

/**
 * 收藏 / 固定 / 活动 三块读接口 + 收藏的增删。
 * 上层只写 `?` 占位符，时间一律 ISO 字符串，所以日期区间可以直接按字符串比较。
 */
export function registerLibraryRoutes(app, { db, T, iso }) {
  const bad = (reply, msg) => reply.code(400).send({ ok: false, error: msg });

  async function decorateFavorites(rows) {
    const worlds = new Map((await db.query(`select id, name, thumbnail from ${T('world')}`)).map((w) => [w.id, w]));
    const friends = new Map(
      (await db.query(`select user_id, display_name, icon_url, location, world_id from ${T('friend')}`)).map((f) => [f.user_id, f]),
    );
    return rows.map((r) => {
      const w = r.kind === 'world' ? worlds.get(r.target_id) : null;
      const f = r.kind === 'friend' ? friends.get(r.target_id) : null;
      return {
        id: r.id,
        kind: r.kind,
        target_id: r.target_id,
        name: w?.name ?? f?.display_name ?? r.target_id,
        thumbnail: w?.thumbnail ?? f?.icon_url ?? null,
        location: f?.location ?? null,
        group_id: r.group_id ?? null,
        note: r.note ?? null,
        pinned: !!Number(r.pinned),
        sort_order: Number(r.sort_order ?? 0),
        created_at: iso(r.created_at),
      };
    });
  }

  async function listFavorites() {
    const rows = await db.query(
      `select id, kind, target_id, group_id, note, pinned, sort_order, created_at
         from ${T('favorite')} order by sort_order, created_at desc`,
    );
    return decorateFavorites(rows);
  }

  app.get('/api/favorites', async () => {
    const favorites = await listFavorites();
    const groups = await db.query(
      `select id, name, sort_order from ${T('favorite_group')} order by sort_order, name`,
    );
    return {
      groups: groups.map((g) => ({
        ...g,
        count: favorites.filter((f) => f.group_id === g.id).length,
      })),
      favorites,
    };
  });

  app.post('/api/favorites', async (req, reply) => {
    const b = req.body ?? {};
    const kind = b.kind;
    const targetId = b.targetId ?? b.target_id;
    if (!['world', 'friend'].includes(kind)) return bad(reply, 'kind 只能是 world 或 friend');
    if (!targetId || typeof targetId !== 'string') return bad(reply, '缺 targetId');

    const note = b.note ?? null;
    const groupId = b.groupId ?? b.group_id ?? null;
    const pinned = b.pinned ? true : false;
    const sortOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;

    const [exist] = await db.query(
      `select id from ${T('favorite')} where kind = ? and target_id = ?`,
      [kind, targetId],
    );
    if (exist) {
      await db.query(
        `update ${T('favorite')} set group_id = ?, note = ?, pinned = ?, sort_order = ? where id = ?`,
        [groupId, note, pinned, sortOrder, exist.id],
      );
      return { ok: true, id: exist.id, updated: true };
    }
    const id = crypto.randomUUID();
    await db.query(
      `insert into ${T('favorite')} (id, kind, target_id, group_id, note, pinned, sort_order)
       values (?,?,?,?,?,?,?)`,
      [id, kind, targetId, groupId, note, pinned, sortOrder],
    );
    return { ok: true, id, updated: false };
  });

  app.delete('/api/favorites/:id', async (req, reply) => {
    const [exist] = await db.query(`select id from ${T('favorite')} where id = ?`, [req.params.id]);
    if (!exist) return reply.code(404).send({ ok: false, error: '没有这条收藏' });
    await db.query(`delete from ${T('favorite')} where id = ?`, [req.params.id]);
    return { ok: true, deleted: req.params.id };
  });

  app.post('/api/favorite-groups', async (req, reply) => {
    const name = (req.body?.name ?? '').trim();
    if (!name) return bad(reply, '缺 name');
    const [exist] = await db.query(`select id from ${T('favorite_group')} where name = ?`, [name]);
    if (exist) return { ok: true, id: exist.id, updated: true };
    const id = crypto.randomUUID();
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    await db.query(`insert into ${T('favorite_group')} (id, name, sort_order) values (?,?,?)`, [id, name, sortOrder]);
    return { ok: true, id, updated: false };
  });

  app.delete('/api/favorite-groups/:id', async (req) => {
    await db.query(`update ${T('favorite')} set group_id = null where group_id = ?`, [req.params.id]);
    await db.query(`delete from ${T('favorite_group')} where id = ?`, [req.params.id]);
    return { ok: true, deleted: req.params.id };
  });

  /** 侧栏固定区：固定的世界 + 当前在里面的人数 */
  app.get('/api/pinned', async () => {
    const rows = await db.query(
      `select f.id, f.target_id, f.note, f.sort_order,
              coalesce(w.name, f.target_id) as name, w.thumbnail
         from ${T('favorite')} f left join ${T('world')} w on w.id = f.target_id
        where f.kind = 'world' and f.pinned = ?
        order by f.sort_order, f.created_at`,
      [true],
    );
    const counts = new Map();
    for (const f of await db.query(
      `select world_id, count(*) as n from ${T('friend')}
        where location is not null and location not in ('offline','private','traveling')
        group by world_id`,
    )) counts.set(f.world_id, Number(f.n));

    return {
      pinned: rows.map((r) => ({
        id: r.id,
        world_id: r.target_id,
        name: r.name,
        thumbnail: r.thumbnail ?? null,
        note: r.note ?? null,
        online: counts.get(r.target_id) ?? 0,
      })),
    };
  });

  /** 活动：某一天去过的世界 + 同房玩家 */
  app.get('/api/activity', async (req) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? '')
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
    const start = `${date}T00:00:00.000Z`;
    const end = new Date(Date.parse(start) + 86400_000).toISOString();

    const events = await db.query(
      `select kind, location, world_id, at from ${T('self_event')}
        where kind = 'location' and at >= ? and at < ? order by at`,
      [start, end],
    );
    const worlds = new Map((await db.query(`select id, name, thumbnail from ${T('world')}`)).map((w) => [w.id, w]));
    const dayEnd = Date.parse(end);
    const agg = new Map();
    events.forEach((e, i) => {
      const key = e.world_id ?? e.location;
      if (!key) return;
      const stopAt = Math.min(
        i + 1 < events.length ? Date.parse(iso(events[i + 1].at)) : dayEnd,
        Date.parse(iso(e.at)) + 6 * 3600_000, // 断档超过 6h 不算停留
      );
      const minutes = Math.max(0, Math.round((stopAt - Date.parse(iso(e.at))) / 60000));
      const cur = agg.get(key) ?? {
        world_id: e.world_id ?? null,
        world: worlds.get(e.world_id)?.name ?? e.location,
        thumbnail: worlds.get(e.world_id)?.thumbnail ?? null,
        visits: 0,
        minutes: 0,
        first_at: iso(e.at),
        last_at: iso(e.at),
      };
      cur.visits += 1;
      cur.minutes += minutes;
      cur.last_at = iso(e.at);
      agg.set(key, cur);
    });

    const rows = await db.query(
      `select display_name, user_id, world_name, at from ${T('game_event')}
        where kind = 'room_join' and at >= ? and at < ? order by at`,
      [start, end],
    );
    const players = new Map();
    for (const r of rows) {
      const key = r.user_id ?? r.display_name;
      if (!key) continue;
      const cur = players.get(key) ?? { name: r.display_name ?? r.user_id, user_id: r.user_id ?? null, meets: 0, worlds: [], last_seen: iso(r.at) };
      cur.meets += 1;
      cur.last_seen = iso(r.at);
      if (r.world_name && !cur.worlds.includes(r.world_name)) cur.worlds.push(r.world_name);
      players.set(key, cur);
    }

    return {
      date,
      worlds: [...agg.values()].sort((a, b) => (a.first_at < b.first_at ? -1 : 1)),
      players: [...players.values()].sort((a, b) => b.meets - a.meets).slice(0, 200),
    };
  });
}
