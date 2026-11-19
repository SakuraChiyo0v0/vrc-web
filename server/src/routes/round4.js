/**
 * 第四轮：世界库 / 好友备注与标签 / 事件日历 / 今日摘要 / 全量备份 / 断连告警。
 *
 * 全部只写本地库（friend_note / friend_tag / alert_event），不碰 VRChat。
 * SQL 只写 `?`，聚合尽量放 JS，保证 PG 与 SQLite 结果一致。
 * 日期切分统一按 +08:00，和前端显示对得上。
 */
import crypto from 'node:crypto';
import { matchText } from '../lib/pinyin.js';

const TZ = 8 * 3600_000;
const DAY = 86400_000;

/** +08:00 的当天零点（返回毫秒） */
const localMidnight = (ms = Date.now()) => Math.floor((ms + TZ) / DAY) * DAY - TZ;
const dayKey = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);

export function registerRound4Routes(app, { db, T, iso }) {
  const lower = (v) => String(v ?? '').toLowerCase();

  /**
   * 41 世界库：world 表 + 只在事件里出现过的世界，附我的到访次数/最近一次。
   * sort=recent（最近活跃，默认）| visits（访问次数）| name（世界名）| author（作者）
   * 101 表头排序：dir=asc|desc，缺省按列语义（名字/作者升序，次数/时间降序）
   */
  app.get('/api/worlds', async (req) => {
    const q = String(req.query.q ?? '').trim();
    const sortKey = ['visits', 'name', 'author', 'recent'].includes(String(req.query.sort))
      ? String(req.query.sort)
      : 'recent';
    const defDir = sortKey === 'name' || sortKey === 'author' ? 'asc' : 'desc';
    const dir = req.query.dir === 'asc' || req.query.dir === 'desc' ? String(req.query.dir) : defDir;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

    const base = await db.query(
      `select id, name, author_name, capacity, thumbnail from ${T('world')}`,
    );
    const mine = await db.query(
      `select world_id, count(*) as n, max(at) as last_at from ${T('self_event')}
        where world_id is not null and kind = 'location' group by world_id`,
    ).catch(() => []);
    const seen = await db.query(
      `select world_id, world_name, count(distinct coalesce(user_id, display_name)) as people, max(at) as last_at
         from ${T('friend_event')} where world_id is not null group by world_id, world_name`,
    ).catch(() => []);

    const map = new Map();
    for (const w of base) {
      map.set(w.id, {
        id: w.id,
        name: w.name ?? w.id,
        author_name: w.author_name ?? null,
        capacity: w.capacity === null || w.capacity === undefined ? null : Number(w.capacity),
        thumbnail: w.thumbnail ?? null,
        visits: 0,
        minutes: 0,
        friends_seen: 0,
        last_at: null,
      });
    }
    for (const r of mine) {
      const cur = map.get(r.world_id) ?? {
        id: r.world_id, name: r.world_id, author_name: null, capacity: null,
        thumbnail: null, visits: 0, minutes: 0, friends_seen: 0, last_at: null,
      };
      cur.visits = Number(r.n ?? 0);
      cur.last_at = r.last_at ? iso(r.last_at) : null;
      map.set(r.world_id, cur);
    }
    for (const r of seen) {
      const cur = map.get(r.world_id) ?? {
        id: r.world_id, name: r.world_name ?? r.world_id, author_name: null, capacity: null,
        thumbnail: null, visits: 0, minutes: 0, friends_seen: 0, last_at: null,
      };
      if (!cur.name || cur.name === r.world_id) cur.name = r.world_name ?? cur.name;
      cur.friends_seen = Number(r.people ?? 0);
      const last = r.last_at ? iso(r.last_at) : null;
      if (last && (!cur.last_at || last > cur.last_at)) cur.last_at = last;
      map.set(r.world_id, cur);
    }

    let list = [...map.values()];
    if (q) list = list.filter((w) => matchText(w.name, q) || matchText(w.author_name, q));
    const sorters = {
      recent: (a, b) => cmpLast(a, b),
      visits: (a, b) => b.visits - a.visits || cmpLast(a, b),
      name: (a, b) => lower(a.name).localeCompare(lower(b.name), 'zh-Hans-CN') || lower(a.id).localeCompare(lower(b.id)),
      author: (a, b) => lower(a.author_name).localeCompare(lower(b.author_name), 'zh-Hans-CN')
        || lower(a.name).localeCompare(lower(b.name), 'zh-Hans-CN'),
    };
    const cmp = sorters[sortKey] ?? sorters.recent;
    list.sort((a, b) => (dir === 'asc' ? -cmp(a, b) : cmp(a, b)));

    const total = list.length;
    const page = list.slice(offset, offset + limit);
    return {
      total,
      returned: page.length,
      limit,
      offset,
      has_more: offset + page.length < total,
      q,
      sort: sortKey,
      dir,
      worlds: page,
    };
  });

  // —— 42 好友备注 + 标签（本地） ——
  app.get('/api/friend/:id/note', async (req) => {
    const id = String(req.params.id);
    const [row] = await db.query(
      `select user_id, note, updated_at from ${T('friend_note')} where user_id = ?`, [id],
    );
    return {
      user_id: id,
      note: row?.note ?? null,
      updated_at: row?.updated_at ? iso(row.updated_at) : null,
    };
  });

  /** PUT { note } —— 空串等同删备注 */
  app.put('/api/friend/:id/note', async (req, reply) => {
    const id = String(req.params.id);
    if (!id) return reply.code(400).send({ ok: false, error: '缺好友 id' });
    const body = req.body ?? {};
    if (typeof body.note !== 'string') return reply.code(400).send({ ok: false, error: 'note 必须是字符串' });
    const note = body.note.trim().slice(0, 2000);
    if (!note) {
      await db.query(`delete from ${T('friend_note')} where user_id = ?`, [id]);
      return { ok: true, user_id: id, note: null, deleted: true };
    }
    const now = new Date().toISOString();
    const [hit] = await db.query(`select user_id from ${T('friend_note')} where user_id = ?`, [id]);
    if (hit) {
      await db.query(`update ${T('friend_note')} set note = ?, updated_at = ? where user_id = ?`, [note, now, id]);
    } else {
      await db.query(`insert into ${T('friend_note')} (user_id, note, updated_at) values (?,?,?)`, [id, note, now]);
    }
    return { ok: true, user_id: id, note, updated_at: now, deleted: false };
  });

  app.get('/api/friend/:id/tags', async (req) => {
    const id = String(req.params.id);
    const rows = await db.query(
      `select tag, created_at from ${T('friend_tag')} where user_id = ? order by created_at, tag`, [id],
    );
    return { user_id: id, tags: rows.map((r) => r.tag), detail: rows.map((r) => ({ ...r, created_at: iso(r.created_at) })) };
  });

  /** POST { tag, action: 'add'|'remove' }（默认 add）—— 增删后返回最新标签 */
  app.post('/api/friend/:id/tag', async (req, reply) => {
    const id = String(req.params.id);
    const body = req.body ?? {};
    const tag = String(body.tag ?? '').trim().slice(0, 40);
    const action = body.action === 'remove' ? 'remove' : 'add';
    if (!tag) return reply.code(400).send({ ok: false, error: '缺 tag' });
    if (action === 'add') {
      // on conflict do nothing：SQLite ≥3.24 与 PG 都支持
      await db.query(
        `insert into ${T('friend_tag')} (id, user_id, tag, created_at) values (?,?,?,?)
         on conflict do nothing`,
        [crypto.randomUUID(), id, tag, new Date().toISOString()],
      );
    } else {
      await db.query(`delete from ${T('friend_tag')} where user_id = ? and tag = ?`, [id, tag]);
    }
    const rows = await db.query(
      `select tag from ${T('friend_tag')} where user_id = ? order by created_at, tag`, [id],
    );
    return { ok: true, user_id: id, action, tag, tags: rows.map((r) => r.tag) };
  });

  /** 43 事件日历：某月每天的 friend_event 计数（+08:00 切日） */
  app.get('/api/calendar', async (req, reply) => {
    const month = String(req.query.month ?? dayKey(Date.now()).slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return reply.code(400).send({ ok: false, error: 'month 必须是 YYYY-MM' });
    }
    const [y, m] = month.split('-').map(Number);
    const firstMs = Date.UTC(y, m - 1, 1) - TZ;          // +08:00 当月 1 号 00:00
    const nextMs = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - TZ;
    const daysInMonth = Math.round((nextMs - firstMs) / DAY);

    const rows = await db.query(
      `select at from ${T('friend_event')} where at >= ? and at < ?`,
      [new Date(firstMs).toISOString(), new Date(nextMs).toISOString()],
    ).catch(() => []);
    const gameRows = await db.query(
      `select at from ${T('game_event')} where at >= ? and at < ?`,
      [new Date(firstMs).toISOString(), new Date(nextMs).toISOString()],
    ).catch(() => []);

    const counts = new Map();
    for (const r of rows) {
      const k = dayKey(new Date(iso(r.at)).getTime());
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const gameCounts = new Map();
    for (const r of gameRows) {
      const k = dayKey(new Date(iso(r.at)).getTime());
      gameCounts.set(k, (gameCounts.get(k) ?? 0) + 1);
    }

    const days = [];
    for (let i = 0; i < daysInMonth; i++) {
      const key = dayKey(firstMs + i * DAY);
      days.push({ date: key, n: counts.get(key) ?? 0, game: gameCounts.get(key) ?? 0 });
    }
    return {
      month,
      daysInMonth,
      first_weekday: new Date(firstMs + TZ).getUTCDay(), // 1 号是周几（0=周日）
      total: days.reduce((a, d) => a + d.n, 0),
      max: Math.max(1, ...days.map((d) => d.n)),
      days,
    };
  });

  /** 44 今日摘要：在线时长 / 遇到人数 / 新世界数 */
  app.get('/api/summary/today', async () => {
    const startMs = localMidnight();
    const startIso = new Date(startMs).toISOString();
    const date = dayKey(startMs);

    // 在线时长：self_event 相邻两条之间算停留，单段封顶 6 小时（避免关机断档算成一天）
    const selfRows = await db.query(
      `select kind, location, at from ${T('self_event')} order by at`,
    ).catch(() => []);
    let onlineMinutes = 0;
    for (let i = 0; i < selfRows.length; i++) {
      const cur = selfRows[i];
      const at = new Date(iso(cur.at)).getTime();
      if (at < startMs) continue;
      const next = selfRows[i + 1];
      const end = next ? new Date(iso(next.at)).getTime() : Date.now();
      const mins = Math.min(Math.round((end - at) / 60000), 360);
      if (mins > 0) onlineMinutes += mins;
    }

    const game = await db.query(
      `select distinct display_name, user_id from ${T('game_event')}
        where kind = 'room_join' and at >= ?`, [startIso],
    ).catch(() => []);

    // 新世界：首次到访就发生在今天
    const firstVisits = await db.query(
      `select world_id, min(at) as first_at from ${T('self_event')}
        where kind = 'location' and world_id is not null group by world_id`,
    ).catch(() => []);
    const newWorlds = firstVisits.filter((r) => new Date(iso(r.first_at)).getTime() >= startMs);

    const [ev] = await db.query(
      `select count(*) as n from ${T('friend_event')} where at >= ?`, [startIso],
    ).catch(() => [null]);

    return {
      date,
      onlineMinutes,
      players: game.length,
      newWorlds: newWorlds.length,
      friendsTracked: (await db.query(`select count(*) as n from ${T('friend')}`).catch(() => [{ n: 0 }]))[0]?.n,
      events: Number(ev?.n ?? 0),
      newWorldList: newWorlds.slice(0, 10).map((r) => r.world_id),
    };
  });

  /** 45 全量备份：6 个键（好友/世界/事件/收藏/备注/标签） */
  app.get('/api/export/backup.json', async (req, reply) => {
    const rows = async (sql, p) => {
      try { return await db.query(sql, p); } catch { return []; }
    };
    const friends = await rows(`select * from ${T('friend')} order by display_name`);
    const worlds = await rows(`select * from ${T('world')} order by name`);
    const events = await rows(
      `select id, user_id, display_name, kind, location, world_id, world_name, at
         from ${T('friend_event')} order by at desc limit 20000`,
    );
    const favorites = await rows(`select * from ${T('favorite')} order by kind, sort_order`);
    const notes = await rows(`select user_id, note, updated_at from ${T('friend_note')}`);
    const tags = await rows(`select user_id, tag, created_at from ${T('friend_tag')}`);

    // 时间字段统一 ISO，SQLite(timestamp) 与 PG(Date) 输出一致
    const norm = (list, fields) => list.map((r) => {
      const o = { ...r };
      for (const f of fields) if (o[f]) o[f] = iso(o[f]);
      return o;
    });

    const payload = {
      friends: norm(friends, ['updated_at']),
      worlds: norm(worlds, ['updated_at']),
      events: norm(events, ['at']),
      favorites: norm(favorites, ['created_at']),
      notes: norm(notes, ['updated_at']),
      tags: norm(tags, ['created_at']),
    };
    reply.header('content-disposition', `attachment; filename="vrc-backup-${dayKey(Date.now())}.json"`);
    return payload;
  });

  /** 46 告警事件列表（diagnostics 判 stale 时写入） */
  app.get('/api/alerts', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 200);
    const rows = await db.query(
      `select id, fingerprint, level, source, message, created_at, resolved_at
         from ${T('alert_event')} order by created_at desc limit ?`, [limit],
    ).catch(() => []);
    return {
      returned: rows.length,
      alerts: rows.map((r) => ({
        ...r,
        created_at: iso(r.created_at),
        resolved_at: r.resolved_at ? iso(r.resolved_at) : null,
        resolved: !!r.resolved_at,
      })),
    };
  });

  return null;
}

function cmpLast(a, b) {
  if (a.last_at === b.last_at) return (a.name ?? '').localeCompare(b.name ?? '');
  if (!a.last_at) return 1;
  if (!b.last_at) return -1;
  return a.last_at < b.last_at ? 1 : -1;
}
