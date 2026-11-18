/**
 * 104 通知同类聚合：同一 type、相邻两条间隔 < 24h 的合并成一条。
 *
 * 纯函数（不碰 db），/api/notifications 和 parity10 检查共用同一份实现。
 *   aggregateNotifications(items) → [{ ...最新一条, count, ids, items, unseen, first_at, last_at }]
 *
 * 输入不要求有序：内部按 created_at 倒序后再分组；时间坏掉的条目单独成组。
 */
export const WINDOW_MS = 24 * 3600_000;

const ms = (v) => {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

export function aggregateNotifications(items, { windowMs = WINDOW_MS } = {}) {
  const list = (Array.isArray(items) ? items : [])
    .map((n, i) => ({ n, i, t: ms(n.created_at) }))
    .sort((a, b) => (b.t ?? -Infinity) - (a.t ?? -Infinity) || a.i - b.i);

  const groups = [];
  const cur = new Map(); // type → 当前（最新）组
  for (const { n, t } of list) {
    const g = cur.get(n.type);
    if (g && t !== null && g.lastMs !== null && g.lastMs - t < windowMs) {
      g.count += 1;
      g.ids.push(n.id);
      g.items.push(n);
      g.unseen += n.seen ? 0 : 1;
      g.first_at = n.created_at;
      continue;
    }
    const ng = {
      ...n,
      count: 1,
      ids: [n.id],
      items: [n],
      unseen: n.seen ? 0 : 1,
      first_at: n.created_at,
      last_at: n.created_at,
      lastMs: t,
    };
    groups.push(ng);
    cur.set(n.type, ng);
  }
  return groups.map(({ lastMs, ...g }) => g);
}
