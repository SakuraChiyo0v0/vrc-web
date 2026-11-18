import { SORT_COLUMNS } from '../lib/sort.js';

const arrow = (active, dir) => (active ? (dir === 'asc' ? '↑' : '↓') : '↕');

/** 101 表格表头：可点排序，aria-sort 跟着方向走 */
export function SortTh({ section, col, sort, onSort, children, ...rest }) {
  const active = sort?.key === col;
  const dir = active ? sort.dir : SORT_COLUMNS[section][col]?.dir ?? 'asc';
  return (
    <th
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      data-sort-th={section}
      {...rest}
    >
      <button
        type="button"
        className="sort-btn"
        data-sort={col}
        data-active={active}
        data-dir={dir}
        onClick={() => onSort(col)}
        title="点击排序"
      >
        {children ?? SORT_COLUMNS[section][col]?.label ?? col}
        <span className="sort-arrow" aria-hidden="true">{arrow(active, dir)}</span>
      </button>
    </th>
  );
}

/** 非表格页面（好友位置 / 好友历史）的列头，和 .friend-row 同一套 grid 列宽 */
export function SortCol({ section, col, sort, onSort, className = '', children }) {
  const active = sort?.key === col;
  const dir = active ? sort.dir : SORT_COLUMNS[section][col]?.dir ?? 'asc';
  return (
    <button
      type="button"
      className={`sort-btn ${className}`}
      data-sort={col}
      data-active={active}
      data-dir={dir}
      aria-label={`按${SORT_COLUMNS[section][col]?.label ?? col}排序`}
      onClick={() => onSort(col)}
      title="点击排序"
    >
      {children ?? SORT_COLUMNS[section][col]?.label ?? col}
      <span className="sort-arrow" aria-hidden="true">{arrow(active, dir)}</span>
    </button>
  );
}
