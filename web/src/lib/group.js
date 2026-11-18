/**
 * 107 好友列表分组：按 世界 / 收藏 / 信任等级 分堆，组头带计数。
 *
 *   const groups = groupFriends(rows, 'world');
 *   groups → [{ key, label, count, rows }]   （离线/未收藏/未知永远垫底）
 *
 * 纯函数，node 可直接测；页面只负责渲染组头。
 */

export const GROUP_MODES = {
  none: '不分组',
  world: '按世界',
  favorite: '按收藏',
  trust: '按信任等级'
};

const TRUST_NAME = { 4: '可信用户', 3: '已知用户', 2: '基本用户', 1: '新用户' };
export const TRUST_LABEL = (rank) => TRUST_NAME[rank] ?? '未分级';

const TRUST_ORDER = [4, 3, 2, 1];

/** 空 label 的组（离线/未收藏/未知）排最后 */
const tail = (key) => (key === 'offline' || key === 'nofav' || key === 'unknown' ? 1 : 0);

export function groupFriends(rows, mode = 'none') {
  const list = Array.isArray(rows) ? rows : [];
  if (!mode || mode === 'none' || !GROUP_MODES[mode]) {
    return [{ key: 'all', label: '', count: list.length, rows: list }];
  }

  const map = new Map();
  const put = (key, label, row) => {
    if (!map.has(key)) map.set(key, { key, label, count: 0, rows: [] });
    const g = map.get(key);
    g.count += 1;
    g.rows.push(row);
  };

  for (const f of list) {
    if (mode === 'world') {
      const online = f.online !== false && f.location !== 'offline';
      const key = online ? (f.world_id ?? f.world_name ?? 'offline') : 'offline';
      const label = online ? (f.world_name ?? f.world_id ?? '未知世界') : '不在线';
      put(key, label, f);
    } else if (mode === 'favorite') {
      if (f.favorite) put('fav', '收藏', f);
      else put('nofav', '未收藏', f);
    } else if (mode === 'trust') {
      const rank = Number(f.trust_rank) || null;
      put(rank ? `trust:${rank}` : 'unknown', TRUST_LABEL(rank), f);
    }
  }

  const rankOf = (g) => {
    if (mode === 'trust') {
      if (!g.key.startsWith('trust:')) return TRUST_ORDER.length;
      const i = TRUST_ORDER.indexOf(Number(g.key.slice(6)));
      return i === -1 ? TRUST_ORDER.length : i;
    }
    return tail(g.key);
  };

  return [...map.values()].sort((a, b) => rankOf(a) - rankOf(b) || b.count - a.count);
}
