/**
 * 好友位置页分栏（docs/ref/vrcx0-locations.png 实测）：
 *   同一世界实例 ≥2 人 → 该世界一组；
 *   单人：收藏 → 「好友收藏」，私密 → 「位于私人房间」，其余 → 「其他在线好友」；
 *   离线垫底（离线好友的 location 可能残留 'private'，也必须进「离线」而不是私人房间）。
 * 纯函数，node 可直接测；页面只负责渲染组头与卡片网格。
 */

const ORDER = { world: 0, favorite: 1, others: 2, private: 3, offline: 4 };

/** 组头标题只放「世界名 · 访问级别」：区域由组头的 .loc-code 徽标单独渲染，避免 JPJP 重复 */
export function worldTitle(f) {
  const name = f.world_name ?? f.world_id ?? '未知世界';
  const access = f.access_label ? ` · ${f.access_label}` : '';
  return `${name}${access}`;
}

function isPrivate(f) {
  return f.location === 'private';
}

/** 不是世界实例的哨兵位置：不能拿 location 当世界 key 分桶（两人都在 traveling 不该拼成一栏） */
const SENTINEL = new Set(['private', 'traveling', 'offline']);

export function groupFriendsByLocation(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const online = list.filter((f) => f.online);
  const offline = list.filter((f) => !f.online);

  // 同一世界同一实例算一栏；location 带实例号（wrld_x:12345~region(jp)）
  const buckets = new Map();
  for (const f of online) {
    if (SENTINEL.has(String(f.location))) continue;
    const k = f.location || `solo:${f.user_id}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(f);
  }

  const groups = [];
  const singles = { favorite: [], others: [] };
  const bucketed = new Set();
  for (const people of buckets.values()) {
    for (const p of people) bucketed.add(p.user_id);
    if (people.length >= 2) {
      const f = people[0];
      groups.push({
        key: `world:${f.location || f.world_id}`,
        type: 'world',
        label: worldTitle(f),
        region: f.region ? String(f.region).toUpperCase() : null,
        access_label: f.access_label ?? null,
        rows: people
      });
    } else {
      const f = people[0];
      singles[f.favorite ? 'favorite' : 'others'].push(f);
    }
  }

  // 切换中/没有位置串的在线人：不进世界桶，按收藏与否落到单人栏（否则会从页面上消失）
  for (const f of online) {
    if (isPrivate(f) || bucketed.has(f.user_id)) continue;
    singles[f.favorite ? 'favorite' : 'others'].push(f);
  }

  // 私人房间只收在线；离线的哪怕 location 还留着 'private' 也归离线
  const push = (type, label, people) => {
    if (people.length) groups.push({ key: type, type, label, region: null, access_label: null, rows: people });
  };
  push('favorite', '好友收藏', singles.favorite);
  push('others', '其他在线好友', singles.others);
  push('private', '位于私人房间', online.filter(isPrivate));
  push('offline', '离线', offline);

  groups.sort((a, b) => {
    if (ORDER[a.type] !== ORDER[b.type]) return ORDER[a.type] - ORDER[b.type];
    if (a.type === 'world') return b.rows.length - a.rows.length || a.label.localeCompare(b.label);
    return 0;
  });
  return groups;
}
