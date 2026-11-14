/**
 * 只读数据聚合：HTTP 路由、/api/ext/*、MCP 三处共用，保证数字一处算。
 * 时间一律 ISO 字符串；聚合在 JS 里做，SQLite / PG 行为一致。
 */
const DAY = 86400_000;

export function createStore({ db, T, iso }) {
  const t = (v) => (v instanceof Date ? v.toISOString() : v);
  const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

  async function friends({ onlineOnly = false } = {}) {
    const rows = await db.query(
      `select f.user_id, f.display_name, f.status, f.status_description, f.location,
              f.world_id, coalesce(w.name, f.world_name) as world_name, f.platform, f.icon_url, f.updated_at
         from ${T('friend')} f left join ${T('world')} w on w.id = f.world_id
        ${onlineOnly ? "where f.location is not null and f.location not in ('offline','private','traveling')" : ''}
        order by case when f.location is null or f.location in ('offline','private','traveling') then 1 else 0 end,
                 f.display_name`,
    );
    return rows.map((r) => ({ ...r, updated_at: iso(r.updated_at) }));
  }

  /** 同房玩家：meets / 最后遇到 / 去过的世界 */
  async function players({ minMeets = 1, days = 365 } = {}) {
    // 排除自己：game_event 里也有本人的 room_join，不该出现在「同房玩家」里
    let selfId = null;
    try {
      const [acc] = await db.query(`select vrchat_user_id from ${T('account')} limit 1`);
      selfId = acc?.vrchat_user_id ?? null;
    } catch { /* 表还没建时忽略 */ }
    const rows = await db.query(
      `select display_name, user_id, world_name, at from ${T('game_event')}
        where kind = 'room_join' and at >= ? order by at desc`,
      [daysAgo(days)],
    );
    const map = new Map();
    for (const r of rows) {
      const key = r.user_id ?? r.display_name;
      if (!key) continue;
      if (selfId && r.user_id === selfId) continue;
      const seen = t(r.at);
      const cur = map.get(key);
      if (cur) {
        cur.meets += 1;
        if (seen > cur.last_seen) cur.last_seen = seen;
        if (r.world_name && !cur.worlds.includes(r.world_name)) cur.worlds.push(r.world_name);
      } else {
        map.set(key, {
          name: r.display_name ?? r.user_id,
          user_id: r.user_id ?? null,
          meets: 1,
          last_seen: seen,
          last_world: r.world_name ?? null,
          worlds: r.world_name ? [r.world_name] : [],
        });
      }
    }
    return [...map.values()]
      .filter((p) => p.meets >= Math.max(1, minMeets))
      .sort((a, b) => b.meets - a.meets || (a.last_seen < b.last_seen ? 1 : -1));
  }

  /** 社交洞察：常一起玩 / 渐行渐远 / 最常遇到时段 */
  async function insights({ days = 90, limit = 10 } = {}) {
    const d = Math.min(365, Math.max(7, Number(days) || 90));
    const since = daysAgo(d);
    const rows = await db.query(
      `select display_name, user_id, world_name, at from ${T('game_event')}
        where kind = 'room_join' and at >= ? order by at`,
      [since],
    );

    const now = Date.now();
    const people = new Map();
    const hours = new Array(24).fill(0);
    for (const r of rows) {
      const key = r.user_id ?? r.display_name;
      if (!key) continue;
      const when = new Date(t(r.at));
      const day = t(r.at).slice(0, 10);
      hours[when.getHours()] += 1;
      const cur = people.get(key) ?? {
        name: r.display_name ?? r.user_id,
        user_id: r.user_id ?? null,
        meets: 0,
        days: new Set(),
        worlds: new Map(),
        first_seen: t(r.at),
        last_seen: t(r.at),
      };
      cur.meets += 1;
      cur.days.add(day);
      if (r.world_name) cur.worlds.set(r.world_name, (cur.worlds.get(r.world_name) ?? 0) + 1);
      if (t(r.at) < cur.first_seen) cur.first_seen = t(r.at);
      if (t(r.at) > cur.last_seen) cur.last_seen = t(r.at);
      people.set(key, cur);
    }

    const flat = [...people.values()].map((p) => ({
      name: p.name,
      user_id: p.user_id,
      meets: p.meets,
      active_days: p.days.size,
      first_seen: p.first_seen,
      last_seen: p.last_seen,
      top_world: [...p.worlds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));

    const companions = flat
      .slice()
      .sort((a, b) => b.meets - a.meets || (a.last_seen < b.last_seen ? 1 : -1))
      .slice(0, limit);

    // 渐行渐远：以前常见（≥3 次、跨 ≥2 天），最近 21 天完全没遇到
    const fading = flat
      .filter((p) => p.meets >= 3 && p.active_days >= 2
        && now - Date.parse(p.last_seen) >= 21 * DAY)
      .sort((a, b) => b.meets - a.meets)
      .slice(0, limit)
      .map((p) => ({ ...p, days_since: Math.floor((now - Date.parse(p.last_seen)) / DAY) }));

    const totalHourEvents = hours.reduce((a, b) => a + b, 0);
    const hourItems = hours.map((n, hour) => ({
      hour,
      n,
      share: totalHourEvents ? Number((n / totalHourEvents).toFixed(3)) : 0,
    }));
    const peak = hourItems.slice().sort((a, b) => b.n - a.n)[0];

    return {
      range: { days: d, since, events: rows.length },
      companions: { total: companions.length, items: companions },
      fading: { total: fading.length, items: fading },
      hours: {
        peak: peak && peak.n > 0 ? peak.hour : null,
        total: totalHourEvents,
        items: hourItems,
      },
    };
  }

  return { friends, players, insights };
}
