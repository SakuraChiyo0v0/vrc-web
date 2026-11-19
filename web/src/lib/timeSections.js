/**
 * 118 时间线分段：今天 / 昨天 / 更早（按 +08 切日）。
 * 输入按时间倒序的列表，输出只保留非空段，段内顺序不变。
 */
const TZ = 'Asia/Shanghai';

export function dayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function sectionOf(iso, now = new Date()) {
  const key = dayKey(iso);
  if (!key) return 'earlier';
  const today = dayKey(now.toISOString());
  if (key === today) return 'today';
  const diff = Math.round((new Date(`${today}T00:00:00+08:00`) - new Date(`${key}T00:00:00+08:00`)) / 86400000);
  return diff === 1 ? 'yesterday' : 'earlier';
}

export const SECTION_LABEL = { today: '今天', yesterday: '昨天', earlier: '更早' };

/** 按段切分；段序固定 今天→昨天→更早，段内保持入参顺序 */
export function splitSections(items, getAt = (x) => x?.at, now = new Date()) {
  const list = Array.isArray(items) ? items : [];
  const buckets = { today: [], yesterday: [], earlier: [] };
  for (const it of list) buckets[sectionOf(getAt(it), now)].push(it);
  return ['today', 'yesterday', 'earlier']
    .filter((k) => buckets[k].length)
    .map((k) => ({ key: k, label: SECTION_LABEL[k], items: buckets[k] }));
}
