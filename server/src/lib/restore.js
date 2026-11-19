/**
 * 备份导入。
 *
 * 两种模式：
 *   - 个人数据（默认，113）：只写备注 / 标签 / 收藏，不碰事件流。
 *   - 全量（第十五轮）：额外补好友 / 世界 / 好友动态。空库导入即恢复整份备份；
 *     非空库只补缺，**不覆盖**已有行（线上数据比备份新），也不删任何行。
 *
 * 所有写入都是幂等的：同一份备份导两次，第二次实写 0 条。
 */

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (v === null || v === undefined ? null : String(v));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const toIso = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** 备注 / 标签 / 收藏的校验 + 归一化（两种模式共用） */
function parseUserData(payload) {
  const notes = arr(payload.notes)
    .filter((r) => r && r.user_id && typeof r.note === 'string' && r.note.trim())
    .map((r) => ({ user_id: String(r.user_id), note: String(r.note), updated_at: r.updated_at ?? null }));
  const tags = arr(payload.tags)
    .filter((r) => r && r.user_id && r.tag && String(r.tag).trim())
    .map((r) => ({ user_id: String(r.user_id), tag: String(r.tag).trim(), created_at: r.created_at ?? null }));
  const favorites = arr(payload.favorites)
    .filter((r) => r && r.kind && r.target_id)
    .map((r) => ({
      id: String(r.id ?? `${r.kind}:${r.target_id}`),
      kind: String(r.kind),
      target_id: String(r.target_id),
      group_id: r.group_id ?? null,
      note: r.note ?? null,
      pinned: r.pinned ? 1 : 0,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
      created_at: r.created_at ?? null,
    }));
  return {
    notes,
    tags,
    favorites,
    skipped: { friends: arr(payload.friends).length, worlds: arr(payload.worlds).length, events: arr(payload.events).length },
  };
}

/** 校验 + 归一化；坏输入直接抛错，前端能显示原因 */
export function normalizeBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('备份文件不是 JSON 对象');
  }
  const b = parseUserData(payload);
  if (!b.notes.length && !b.tags.length && !b.favorites.length) {
    throw new Error('备份里没有备注/标签/收藏可导入');
  }
  return b;
}

/** 全量模式：好友 / 世界 / 好友动态 + 个人数据 */
export function normalizeFullBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('备份文件不是 JSON 对象');
  }
  const b = parseUserData(payload);
  const friends = arr(payload.friends)
    .filter((r) => r && r.user_id)
    .map((r) => ({
      user_id: String(r.user_id),
      display_name: str(r.display_name),
      trust_level: str(r.trust_level),
      platform: str(r.platform),
      status: str(r.status),
      status_description: str(r.status_description),
      location: str(r.location),
      world_id: str(r.world_id),
      world_name: str(r.world_name),
      group_name: str(r.group_name),
      avatar_id: str(r.avatar_id),
      icon_url: str(r.icon_url),
      is_favorite: r.is_favorite ? 1 : 0,
      updated_at: toIso(r.updated_at),
    }));
  const worlds = arr(payload.worlds)
    .filter((r) => r && r.id)
    .map((r) => ({
      id: String(r.id),
      name: str(r.name),
      author_id: str(r.author_id),
      author_name: str(r.author_name),
      capacity: num(r.capacity),
      thumbnail: str(r.thumbnail),
      visits_total: num(r.visits_total),
      favorites: num(r.favorites),
      popularity: num(r.popularity),
      updated_at: toIso(r.updated_at),
    }));
  const events = arr(payload.events)
    .filter((r) => r && r.kind && toIso(r.at))
    .map((r) => ({
      user_id: str(r.user_id),
      display_name: str(r.display_name),
      kind: String(r.kind),
      location: str(r.location),
      world_id: str(r.world_id),
      world_name: str(r.world_name),
      at: toIso(r.at),
    }));
  if (!friends.length && !worlds.length && !events.length && !b.notes.length && !b.tags.length && !b.favorites.length) {
    throw new Error('备份里没有可导入的数据');
  }
  return { ...b, friends, worlds, events };
}

/** 写备注 / 标签 / 收藏，返回实写条数 */
async function writeUserData(db, T, b, now) {
  const out = { notes: 0, tags: 0, favorites: 0 };

  for (const n of b.notes) {
    const [hit] = await db.query(`select user_id from ${T('friend_note')} where user_id = ?`, [n.user_id]);
    if (hit) {
      await db.query(
        `update ${T('friend_note')} set note = ?, updated_at = ? where user_id = ?`,
        [n.note, n.updated_at ?? now, n.user_id],
      );
    } else {
      await db.query(
        `insert into ${T('friend_note')} (user_id, note, updated_at) values (?,?,?)`,
        [n.user_id, n.note, n.updated_at ?? now],
      );
    }
    out.notes += 1;
  }

  for (const t of b.tags) {
    await db.query(
      `insert into ${T('friend_tag')} (id, user_id, tag, created_at) values (?,?,?,?)
       on conflict do nothing`,
      [`${t.user_id}:${t.tag}`, t.user_id, t.tag, t.created_at ?? now],
    );
    out.tags += 1;
  }

  for (const f of b.favorites) {
    await db.query(
      `insert into ${T('favorite')} (id, kind, target_id, group_id, note, pinned, sort_order, created_at)
       values (?,?,?,?,?,?,?,?)
       on conflict do nothing`,
      [f.id, f.kind, f.target_id, f.group_id, f.note, f.pinned, f.sort_order, f.created_at ?? now],
    );
    out.favorites += 1;
  }

  return out;
}

/** 个人数据模式：写库，返回 { notes, tags, favorites } 实写条数 */
export async function restoreBackup(db, T, payload) {
  const b = normalizeBackup(payload);
  const now = new Date().toISOString();
  return { ...(await writeUserData(db, T, b, now)), skipped: b.skipped };
}

/**
 * 全量模式：先补好友 / 世界 / 动态（只补缺），再写个人数据。
 * 返回每张表的 inserted / skipped，页面上能直接看出「这份备份恢复了什么」。
 */
export async function restoreFullBackup(db, T, payload) {
  const b = normalizeFullBackup(payload);
  const now = new Date().toISOString();
  const out = { full: true, friends: { inserted: 0, skipped: 0 }, worlds: { inserted: 0, skipped: 0 }, events: { inserted: 0, skipped: 0 } };

  const haveFriends = new Set((await db.query(`select user_id from ${T('friend')}`)).map((r) => r.user_id));
  for (const f of b.friends) {
    if (haveFriends.has(f.user_id)) { out.friends.skipped += 1; continue; }
    await db.query(
      `insert into ${T('friend')}
        (user_id, display_name, trust_level, platform, status, status_description,
         location, world_id, world_name, group_name, avatar_id, icon_url, is_favorite, updated_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [f.user_id, f.display_name, f.trust_level, f.platform, f.status, f.status_description,
        f.location, f.world_id, f.world_name, f.group_name, f.avatar_id, f.icon_url,
        f.is_favorite, f.updated_at ?? now],
    );
    haveFriends.add(f.user_id);
    out.friends.inserted += 1;
  }

  const haveWorlds = new Set((await db.query(`select id from ${T('world')}`)).map((r) => r.id));
  for (const w of b.worlds) {
    if (haveWorlds.has(w.id)) { out.worlds.skipped += 1; continue; }
    await db.query(
      `insert into ${T('world')}
        (id, name, author_id, author_name, capacity, thumbnail, visits_total, favorites, popularity, updated_at)
       values (?,?,?,?,?,?,?,?,?,?)`,
      [w.id, w.name, w.author_id, w.author_name, w.capacity, w.thumbnail,
        w.visits_total, w.favorites, w.popularity, w.updated_at ?? now],
    );
    haveWorlds.add(w.id);
    out.worlds.inserted += 1;
  }

  // 事件没有稳定主键（PG 的 id 是自增，备份里的 id 导回去会撞），按 (user_id, kind, at) 去重
  if (b.events.length) {
    const times = b.events.map((e) => e.at).sort();
    const from = times[0];
    const to = times[times.length - 1];
    const seen = new Set(
      (await db.query(
        `select user_id, kind, at from ${T('friend_event')} where at >= ? and at <= ?`,
        [from, to],
      )).map((r) => `${r.user_id ?? ''}|${r.kind}|${toIso(r.at)}`),
    );
    for (const e of b.events) {
      const key = `${e.user_id ?? ''}|${e.kind}|${e.at}`;
      if (seen.has(key)) { out.events.skipped += 1; continue; }
      await db.query(
        `insert into ${T('friend_event')} (user_id, display_name, kind, location, world_id, world_name, at)
         values (?,?,?,?,?,?,?)`,
        [e.user_id, e.display_name, e.kind, e.location, e.world_id, e.world_name, e.at],
      );
      seen.add(key);
      out.events.inserted += 1;
    }
  }

  Object.assign(out, await writeUserData(db, T, b, now));
  return out;
}
