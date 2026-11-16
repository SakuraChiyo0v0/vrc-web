/**
 * 洞察页柱状图尺寸（70）。
 *
 * 故意返回**像素**而不是百分比：柱子的父容器是 auto 高度的 flex 列，
 * 百分比高度解析不到参照（浏览器算成 auto → 0px），这就是「文字有结论、图上没柱」的根因。
 */
export const BAR_AREA_PX = 88;

/** 有数据时返回每根柱的 px 高度与占比；无数据时 bars 为空数组（页面显示空态，不画空轴） */
export function hourBars(items, { area = BAR_AREA_PX } = {}) {
  const rows = (items ?? [])
    .filter((h) => h && Number.isFinite(Number(h.hour)))
    .slice()
    .sort((a, b) => Number(a.hour) - Number(b.hour));
  const total = rows.reduce((s, h) => s + Math.max(0, Number(h.n) || 0), 0);
  if (!rows.length || total <= 0) return { empty: true, total: 0, peak: null, max: 0, bars: [] };

  const max = Math.max(...rows.map((h) => Math.max(0, Number(h.n) || 0)));
  const bars = rows.map((h) => {
    const n = Math.max(0, Number(h.n) || 0);
    const ratio = max ? n / max : 0;
    return {
      hour: Number(h.hour),
      n,
      share: total ? Number((n / total).toFixed(3)) : 0,
      // 最矮 2px 保证「有 1 次也看得见」，最高的正好占满 area
      px: n ? Math.max(2, Math.round(ratio * area)) : 0,
      opacity: n ? Number((0.35 + ratio * 0.55).toFixed(2)) : 0,
    };
  });
  const peak = bars.slice().sort((a, b) => b.n - a.n || a.hour - b.hour)[0];
  return { empty: false, total, peak: peak.n ? peak.hour : null, max, bars };
}
