/**
 * 第十五轮：CSV 多表导出。
 *
 * 一张表一条定义，`/api/export/index.json` 用同一份清单列可用表 + 行数，
 * `/api/export/<name>.csv` 按清单取列，页面上的下载入口也照这份清单生成，
 * 三处不会各写一套字段名。
 */

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (cols, rows) =>
  [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

/** 玩家表按 game_event 聚合，单独一段，其余都是单表直查 */
async function playerRows(db, T, iso) {
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
  return [...map.values()]
    .sort((a, b) => b.meets - a.meets)
    .map((r) => ({ ...r, worlds: r.worlds.join(' / ') }));
}

/**
 * 表清单。`count` 走 count(*)，`rows` 拉真实数据；csv 与页面只认 name/cols。
 */
export const TABLES = {
  friends: {
    label: '好友',
    cols: ['user_id', 'display_name', 'status', 'location', 'world_name', 'platform', 'updated_at'],
    table: 'friend',
    rows: async (db, T, iso) => (await db.query(
      `select user_id, display_name, status, location, world_name, platform, updated_at
         from ${T('friend')} order by display_name`,
    )).map((r) => ({ ...r, updated_at: iso(r.updated_at) })),
  },
  worlds: {
    label: '世界',
    cols: ['id', 'name', 'author_name', 'capacity', 'visits_total', 'favorites', 'popularity', 'updated_at'],
    table: 'world',
    rows: async (db, T, iso) => (await db.query(
      `select id, name, author_name, capacity, visits_total, favorites, popularity, updated_at
         from ${T('world')} order by name`,
    )).map((r) => ({ ...r, updated_at: iso(r.updated_at) })),
  },
  events: {
    label: '好友动态',
    cols: ['at', 'kind', 'user_id', 'display_name', 'world_name', 'location'],
    table: 'friend_event',
    rows: async (db, T, iso) => (await db.query(
      `select at, kind, user_id, display_name, world_name, location
         from ${T('friend_event')} order by at desc limit 20000`,
    )).map((r) => ({ ...r, at: iso(r.at) })),
  },
  players: {
    label: '同房玩家',
    cols: ['user_id', 'name', 'meets', 'last_seen', 'worlds'],
    table: 'game_event',
    rows: playerRows,
    // 表里是聚合结果，行数是「不同玩家数」，不是 game_event 的原始条数
    count: async (db, T) => (await db.query(
      `select count(distinct coalesce(user_id, display_name)) as n from ${T('game_event')} where kind = 'room_join'`,
    ))[0]?.n,
  },
  sessions: {
    label: '好友在线区间',
    cols: ['user_id', 'started_at', 'ended_at', 'minutes', 'world_name', 'status'],
    table: 'friend_session',
    rows: async (db, T, iso) => (await db.query(
      `select user_id, started_at, ended_at, minutes, world_name, status
         from ${T('friend_session')} order by started_at desc limit 20000`,
    )).map((r) => ({ ...r, started_at: iso(r.started_at), ended_at: r.ended_at ? iso(r.ended_at) : null })),
  },
  favorites: {
    label: '收藏',
    cols: ['kind', 'target_id', 'group_id', 'note', 'pinned', 'sort_order', 'created_at'],
    table: 'favorite',
    rows: async (db, T, iso) => (await db.query(
      `select kind, target_id, group_id, note, pinned, sort_order, created_at
         from ${T('favorite')} order by kind, sort_order`,
    )).map((r) => ({ ...r, pinned: r.pinned ? 1 : 0, created_at: iso(r.created_at) })),
  },
  notes: {
    label: '好友备注',
    cols: ['user_id', 'note', 'updated_at'],
    table: 'friend_note',
    rows: async (db, T, iso) => (await db.query(
      `select user_id, note, updated_at from ${T('friend_note')} order by user_id`,
    )).map((r) => ({ ...r, updated_at: iso(r.updated_at) })),
  },
  tags: {
    label: '好友标签',
    cols: ['user_id', 'tag', 'created_at'],
    table: 'friend_tag',
    rows: async (db, T, iso) => (await db.query(
      `select user_id, tag, created_at from ${T('friend_tag')} order by user_id, tag`,
    )).map((r) => ({ ...r, created_at: iso(r.created_at) })),
  },
  'game-events': {
    label: '游戏日志',
    cols: ['at', 'kind', 'display_name', 'user_id', 'world_name', 'location'],
    table: 'game_event',
    rows: async (db, T, iso) => (await db.query(
      `select at, kind, display_name, user_id, world_name, location
         from ${T('game_event')} order by at desc limit 20000`,
    )).map((r) => ({ ...r, at: iso(r.at) })),
  },
  'self-events': {
    label: '自己的足迹',
    cols: ['at', 'kind', 'world_id', 'location'],
    table: 'self_event',
    rows: async (db, T, iso) => (await db.query(
      `select at, kind, world_id, location from ${T('self_event')} order by at desc limit 20000`,
    )).map((r) => ({ ...r, at: iso(r.at) })),
  },
};

export const isExportName = (name) => Object.prototype.hasOwnProperty.call(TABLES, name);

export function buildCsv(name, db, T, iso) {
  const def = TABLES[name];
  if (!def) return null;
  return def.rows(db, T, iso).then((rows) => ({ cols: def.cols, rows }));
}

/** 设置页用：每张表的行数，一次查询一条 */
export async function exportIndex(db, T) {
  const out = [];
  for (const [name, def] of Object.entries(TABLES)) {
    let count = 0;
    try {
      if (def.count) count = Number(await def.count(db, T)) || 0;
      else {
        const [r] = await db.query(`select count(*) as n from ${T(def.table)}`);
        count = Number(r?.n ?? 0);
      }
    } catch { /* 旧库缺表就当 0，不阻断其它表 */ }
    out.push({ name, label: def.label, file: `api/export/${name}.csv`, rows: count });
  }
  return out;
}
