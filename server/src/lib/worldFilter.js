/**
 * 114 世界库筛选：收藏 / 去过次数 / 容量，三者可组合。
 *
 * 纯函数，路由把库里的行拼好之后调这里，前端也能拿同一套桶位显示标签。
 * 计数（total）永远是「组合筛选后剩下的条数」，不做本地估算。
 */
import { matchText } from './pinyin.js';

/** 容量分桶：前后端共用一份，避免文案对不上 */
export const CAPACITY_BUCKETS = [
  { key: 'any', label: '容量不限', min: null, max: null },
  { key: 'small', label: '≤8 人', min: 0, max: 8 },
  { key: 'mid', label: '9–16 人', min: 9, max: 16 },
  { key: 'large', label: '17–32 人', min: 17, max: 32 },
  { key: 'huge', label: '33 人以上', min: 33, max: null },
];

/** 去过次数档位 */
export const VISIT_STEPS = [
  { key: 'any', label: '次数不限', min: 0 },
  { key: '1', label: '去过 ≥1 次', min: 1 },
  { key: '3', label: '去过 ≥3 次', min: 3 },
  { key: '10', label: '去过 ≥10 次', min: 10 },
];

export const capacityBucket = (key) => CAPACITY_BUCKETS.find((b) => b.key === key) ?? CAPACITY_BUCKETS[0];

/**
 * @param {Array<{name?:string, author_name?:string, visits?:number, capacity?:number|null, fav?:boolean}>} list
 * @param {{q?:string, fav?:boolean|string, minVisits?:number|string, capacity?:string}} f
 * @returns {Array} 过滤后的新数组（不改入参）
 */
export function filterWorlds(list, f = {}) {
  const q = String(f.q ?? '').trim();
  const fav = f.fav === true || f.fav === '1' || f.fav === 'true';
  const minVisits = Math.max(Number(f.minVisits ?? 0) || 0, 0);
  const bucket = capacityBucket(String(f.capacity ?? 'any'));
  return (list ?? []).filter((w) => {
    if (q && !(matchText(w.name, q) || matchText(w.author_name, q))) return false;
    if (fav && !w.fav) return false;
    if (minVisits > 0 && Number(w.visits ?? 0) < minVisits) return false;
    if (bucket.min !== null) {
      // 容量未知的世界不进具体桶位：宁可少给，也不猜
      if (w.capacity === null || w.capacity === undefined) return false;
      const cap = Number(w.capacity);
      if (!(cap >= bucket.min) || (bucket.max !== null && cap > bucket.max)) return false;
    }
    return true;
  });
}
