/**
 * 101/102 表头排序 + 偏好持久化（纯函数，node 可直接跑测试）。
 *
 *   SORT_COLUMNS[section][key] = { label, dir, type, get(row) }
 *   sortRows(rows, cols, key, dir)   稳定排序，空值永远排最后
 *   toggleSort({ key, dir }, cols, nextKey)
 *   readPref/writePref(storage, key, fallback)   localStorage 读写（可传入桩）
 */
const COLL = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

const text = (v) => (v === null || v === undefined ? '' : String(v));
const num = (v) => Number(v ?? 0) || 0;
const time = (v) => (v ? Date.parse(v) || 0 : 0);

/** 四个列表页的排序列（好友位置 / 玩家 / 世界 / 好友历史，外加好友列表） */
export const SORT_COLUMNS = {
  friends: {
    name: { label: '名字', dir: 'asc', type: 'text', get: (f) => f.display_name ?? f.user_id ?? '' },
    status: { label: '状态', dir: 'asc', type: 'text', get: (f) => f.status ?? '' },
    world: { label: '所在世界', dir: 'asc', type: 'text', get: (f) => (f.online ? f.world_name ?? '' : '') },
    duration: { label: '在线时长', dir: 'desc', type: 'num', get: (f) => (f.online_minutes === null || f.online_minutes === undefined ? null : num(f.online_minutes)) }
  },
  players: {
    name: { label: '玩家', dir: 'asc', type: 'text', get: (p) => p.name ?? p.display_name ?? '' },
    meets: { label: '同房', dir: 'desc', type: 'num', get: (p) => num(p.meets) },
    last_seen: { label: '最近一次', dir: 'desc', type: 'time', get: (p) => time(p.last_seen) },
    world: { label: '当时的世界', dir: 'asc', type: 'text', get: (p) => p.last_world ?? '' }
  },
  worlds: {
    name: { label: '世界', dir: 'asc', type: 'text', get: (w) => w.name ?? '' },
    author: { label: '作者', dir: 'asc', type: 'text', get: (w) => w.author_name ?? '' },
    visits: { label: '访问次数', dir: 'desc', type: 'num', get: (w) => num(w.visits) },
    recent: { label: '最近活跃', dir: 'desc', type: 'time', get: (w) => time(w.last_at) }
  },
  friendlog: {
    name: { label: '好友', dir: 'asc', type: 'text', get: (i) => i.display_name ?? i.user_id ?? '' },
    kind: { label: '类型', dir: 'asc', type: 'text', get: (i) => i.kind ?? '' },
    text: { label: '内容', dir: 'asc', type: 'text', get: (i) => i.text ?? '' },
    at: { label: '时间', dir: 'desc', type: 'time', get: (i) => time(i.at) }
  },
  friendlist: {
    name: { label: '好友', dir: 'asc', type: 'text', get: (f) => f.display_name ?? '' },
    trust: { label: '信任等级', dir: 'desc', type: 'num', get: (f) => num(f.trust_rank) },
    last_seen: { label: '最后在线', dir: 'desc', type: 'time', get: (f) => time(f.last_seen) }
  }
};

const tiebreak = (a, b) => COLL.compare(
  text(a?.display_name ?? a?.name ?? a?.user_id ?? a?.id),
  text(b?.display_name ?? b?.name ?? b?.user_id ?? b?.id)
);

export function sortRows(rows, cols, key, dir = 'asc') {
  const col = cols?.[key];
  if (!col || !Array.isArray(rows)) return Array.isArray(rows) ? rows.slice() : [];
  const mul = dir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    const ea = va === null || va === undefined || va === '';
    const eb = vb === null || vb === undefined || vb === '';
    if (ea || eb) return ea && eb ? tiebreak(a, b) : ea ? 1 : -1; // 空值永远垫底
    const d = col.type === 'num' || col.type === 'time'
      ? Number(va) - Number(vb)
      : COLL.compare(String(va), String(vb));
    return d ? d * mul : tiebreak(a, b);
  });
}

/** 点同一列切方向；点别的列用该列的默认方向（时长/最近一次默认降序） */
export function toggleSort(cur, cols, key) {
  const def = cols?.[key];
  if (!def) return cur;
  if (cur?.key === key) return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: def.dir ?? 'asc' };
}

/* ───── 102 偏好持久化：localStorage 形状 vrc-pref:<key> = JSON ───── */
export const PREF_PREFIX = 'vrc-pref:';
export const prefKey = (key) => PREF_PREFIX + key;

export function readPref(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(prefKey(key));
    if (raw === null || raw === undefined) return fallback;
    const v = JSON.parse(raw);
    // 对象形式的偏好合并默认值：以后加字段时旧存档不会丢新字段
    if (v && typeof v === 'object' && !Array.isArray(v)
      && fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      return { ...fallback, ...v };
    }
    return v;
  } catch {
    return fallback;
  }
}

export function writePref(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(prefKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false; // 隐私模式 / 配额满：记忆失效但页面照常
  }
}
