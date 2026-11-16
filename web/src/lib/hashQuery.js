import { useEffect, useState } from 'react';

/** hash 形如 #/friendlist?trust=4&fav=1 —— 页面部分在 ? 之前 */
const pagePart = (h) => h.replace(/^#\/?/, '').split('?')[0];

export function hashParams(hash) {
  const raw = typeof hash === 'string' ? hash : typeof window === 'undefined' ? '' : window.location.hash;
  const qi = raw.indexOf('?');
  return new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
}

const decode = (v, def) => {
  if (v === null) return def;
  if (typeof def === 'boolean') return v === '1';
  if (typeof def === 'number') return Number(v) || def;
  return v;
};

/**
 * 页面筛选 ⇄ 地址栏 hash query。
 * 刷新 / 深链（截图验收直开某页某筛选）能还原；等于默认值的不写进地址，保持链接短。
 * 只用 replaceState（不压历史栈）：既不污染后退，也不触发 App 的 hashchange 重挂。
 */
export function useHashState(defaults) {
  const [state, setPart] = useState(() => {
    const p = hashParams();
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) out[k] = decode(p.get(k), defaults[k]);
    return out;
  });

  useEffect(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v === defaults[k] || v === '' || v === false || v === null || v === undefined) continue;
      q.set(k, typeof v === 'boolean' ? '1' : String(v));
    }
    const h = `#/${pagePart(window.location.hash) || 'friends'}${q.toString() ? `?${q}` : ''}`;
    if (window.location.hash !== h) window.history.replaceState(null, '', h);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setPart((s) => ({ ...s, ...patch }));
  return [state, set];
}
