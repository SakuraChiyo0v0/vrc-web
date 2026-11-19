/**
 * 113 备份导入：把 `GET /api/export/backup.json` 导出的 JSON 里
 * 「用户自己产出的数据」（备注 / 标签 / 收藏）写回本地库。
 *
 * 边界：
 *   - 只补不改事件流：friend_event / game_event / self_event 一行不碰，
 *     否则导入一份旧备份会把动态页倒回过去。
 *   - 备注覆盖同一个人已有的备注（备注是单值，导出里就是最新值）；
 *     标签与收藏只补缺，不删库里已有的（`on conflict do nothing`）。
 *   - 不删任何行，导入永远只会让数据变多（或备注被同一份备份覆盖）。
 */

const arr = (v) => (Array.isArray(v) ? v : []);

/** 校验 + 归一化；坏输入直接抛错，前端能显示原因 */
export function normalizeBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('备份文件不是 JSON 对象');
  }
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
  if (!notes.length && !tags.length && !favorites.length) {
    throw new Error('备份里没有备注/标签/收藏可导入');
  }
  return {
    notes,
    tags,
    favorites,
    // 只用于前端提示「这些不导入」
    skipped: { friends: arr(payload.friends).length, worlds: arr(payload.worlds).length, events: arr(payload.events).length },
  };
}

/** 写库，返回 { notes, tags, favorites } 实写条数 */
export async function restoreBackup(db, T, payload) {
  const b = normalizeBackup(payload);
  const now = new Date().toISOString();
  const out = { notes: 0, tags: 0, favorites: 0, skipped: b.skipped };

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
