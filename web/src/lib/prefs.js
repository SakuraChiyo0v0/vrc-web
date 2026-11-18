/**
 * 101/102 React 侧：把状态存进 localStorage，刷新 / 重开页面后保持。
 *
 *   const [tab, setTab] = usePref('friends:tab', 'online');
 *   const [sort, onSort] = useSort('friends', 'name');   // { key, dir } + 点击列头
 */
import { useEffect, useState } from 'react';
import { SORT_COLUMNS, readPref, toggleSort, writePref } from './sort.js';

const store = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // 某些隐私模式下访问 localStorage 直接抛错
  }
};

export function usePref(key, fallback) {
  const [value, setValue] = useState(() => readPref(store(), key, fallback));
  useEffect(() => {
    writePref(store(), key, value);
  }, [key, value]);
  return [value, setValue];
}

export function useSort(section, defKey = Object.keys(SORT_COLUMNS[section])[0]) {
  const cols = SORT_COLUMNS[section];
  const fallback = { key: defKey, dir: cols[defKey]?.dir ?? 'asc' };
  const [sort, setSort] = usePref(`sort:${section}`, fallback);
  const safe = cols[sort?.key] ? sort : fallback; // 旧存档里的列名已被删掉 → 回默认
  const onSort = (key) => setSort((cur) => toggleSort(cols[cur?.key] ? cur : fallback, cols, key));
  return [safe, onSort];
}
