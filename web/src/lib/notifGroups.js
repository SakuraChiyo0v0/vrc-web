/**
 * 117 通知页按类型分组：
 * 通知列表先按 24h 聚合成条（aggregateNotifications），再按 type 收成「组」。
 * 前端只做视图分组，不改后端返回——组内顺序保持聚合结果的时间序。
 */
export function groupByType(items) {
  const list = Array.isArray(items) ? items : [];
  const map = new Map();
  for (const n of list) {
    const key = n.type ?? 'other';
    const g = map.get(key);
    if (g) {
      g.items.push(n);
      g.unseen += Number(n.unseen ?? (n.seen ? 0 : 1)) || 0;
    } else {
      map.set(key, { type: key, items: [n], unseen: Number(n.unseen ?? (n.seen ? 0 : 1)) || 0 });
    }
  }
  return [...map.values()].map((g) => {
    // 该类型是否「有新东西」决定默认展开：有未读就摊开，全读过就收着
    const newest = g.items[0]?.created_at ?? null;
    return { ...g, count: g.items.length, newest, opened: g.unseen > 0 };
  });
}

/** 组头文案：`邀请 · 3 组 5 条 · 未读 2` */
export function groupSummary(g, typeLabel) {
  const inner = g.items.reduce((n, it) => n + (Number(it.count ?? 1) || 1), 0);
  const head = typeLabel?.[g.type] ?? g.type;
  const parts = [`${g.count} 组`];
  if (inner !== g.count) parts.push(`${inner} 条`);
  if (g.unseen > 0) parts.push(`未读 ${g.unseen}`);
  return `${head} · ${parts.join(' · ')}`;
}
