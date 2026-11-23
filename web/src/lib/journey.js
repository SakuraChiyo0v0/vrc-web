/**
 * 182 旅程/图表用的纯函数：node --test 直接测，不依赖 React。
 * 页面只负责渲染，分组/排序/百分比都在这里算。
 */

/** 按 +08 日期字符串（YYYY-MM-DD）取月份 key（YYYY-MM） */
export const monthOf = (date) => String(date).slice(0, 7);

/** 「2026-11」→「2026 年 11 月」 */
export function monthLabel(key) {
  const s = String(key);
  return `${s.slice(0, 4)} 年 ${Number(s.slice(5, 7))} 月`;
}

/** 柱高百分比：空/负值归 0，最大值归 100（四舍五入，最小 2% 保留可见性） */
export function barPct(value, max) {
  const v = Number(value ?? 0);
  const m = Number(max ?? 0);
  if (!Number.isFinite(v) || !Number.isFinite(m) || v <= 0 || m <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((v / m) * 100)));
}

/**
 * 旅程按「月 → 日」分组：月份倒序（新月份在上），月内日期倒序。
 * 每月带 minutes 合计与 max（画柱用的月内峰值）。
 */
export function groupMonths(days = []) {
  const map = new Map();
  for (const d of days) {
    if (!d?.date) continue;
    const key = monthOf(d.date);
    if (!map.has(key)) map.set(key, { key, days: [], minutes: 0, max: 1 });
    const g = map.get(key);
    g.days.push(d);
    g.minutes += Number(d.minutes ?? 0);
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((g) => {
      g.days.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      g.max = Math.max(1, ...g.days.map((d) => Number(d.minutes ?? 0)));
      g.minutes = Math.round(g.minutes);
      return g;
    });
}

/** 展开一天时把该天所有世界的到访摊平成一条时间线，时间倒序 */
export function dayVisits(day) {
  const rows = [];
  for (const w of day?.worlds ?? []) {
    for (const v of w.visits ?? []) rows.push({ ...v, world_name: w.world_name, world_id: w.world_id });
  }
  return rows.sort((a, b) => String(b.start_at).localeCompare(String(a.start_at)));
}
