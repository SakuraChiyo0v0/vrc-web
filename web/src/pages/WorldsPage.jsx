import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import { SortCol } from '../components/SortHead.jsx';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv.js';
import { usePref, useSort } from '../lib/prefs.js';

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

// 90 缩略图 16:9 铺满卡片；没有图就留同比例灰底 +首字，网格不会跳
function Thumb({ w }) {
  if (w.thumbnail) {
    return (
      <img
        className="thumb"
        src={imgUrl(w.thumbnail)}
        alt=""
        loading="lazy"
        onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'thumb thumb-empty', textContent: (w.name ?? '?').slice(0, 1) })); }}
      />
    );
  }
  return <div className="thumb thumb-empty">{(w.name ?? '?').slice(0, 1)}</div>;
}

/** 41 世界库：所有去过的世界，搜索 + 表头排序（名字/作者/访问次数/最近活跃），点进详情 */
export default function WorldsPage() {
  // 102 搜索词与排序写到 localStorage，刷新保持
  const [q, setQ] = usePref('worlds:q', '');
  const [sort, onSort] = useSort('worlds', 'recent');
  const [offset, setOffset] = useState(0);
  const changeSort = (key) => { onSort(key); setOffset(0); };
  const { openWorld } = useDrawer();
  const LIMIT = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['worlds', q, sort.key, sort.dir, offset],
    queryFn: () => api(`worlds?q=${encodeURIComponent(q)}&sort=${sort.key}&dir=${sort.dir}&limit=${LIMIT}&offset=${offset}`),
  });

  const rows = data?.worlds ?? [];

  // 103 导出跟随筛选：按同样的 q/sort/dir 一页页取到底（接口单页上限 200），
  // 行数 = 顶部「共 N 个世界」，和当前筛选看到的一致。
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let off = 0; off < 5000; off += 200) {
        const page = await api(`worlds?q=${encodeURIComponent(q)}&sort=${sort.key}&dir=${sort.dir}&limit=200&offset=${off}`);
        all.push(...(page.worlds ?? []));
        if (!page.has_more) break;
      }
      const { text } = toCsv([
        { key: 'name', label: '世界' },
        { key: 'author_name', label: '作者' },
        { key: 'visits', label: '到访次数' },
        { key: 'friends_seen', label: '见过的好友' },
        { key: 'capacity', label: '容量' },
        { get: (w) => fmt(w.last_at), label: '最近活跃' },
        { key: 'id', label: 'world_id' }
      ], all);
      downloadCsv(csvFilename(`worlds${q ? '-筛选' : ''}`), text);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
          placeholder="搜索世界 / 作者"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-64 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <span className="chip sm:ml-auto" data-count={data?.total ?? 0}>共 {data?.total ?? 0} 个世界</span>
        <button className="chip" data-export="worlds" onClick={exportNow} disabled={exporting || !data?.total}>
          {exporting ? '导出中…' : '导出 CSV'}
        </button>
      </div>

      {/* 101 世界库列头：点一下排序，再点切方向 */}
      <div className="world-head" data-sort-head="worlds">
        <SortCol section="worlds" col="name" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="author" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="visits" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="recent" sort={sort} onSort={changeSort} />
      </div>

      {isLoading ? (
        <div className="text-[12px] text-fg3">加载中…</div>
      ) : rows.length === 0 ? (
        <Empty icon="star" title={'还没有去过的世界'} hint={'采集器记录到自己进出世界后会出现在这里。'} />
      ) : (
        <div className="world-grid">
          {rows.map((w) => (
            <div key={w.id} className="world-card" onClick={() => openWorld(w.id)} title={w.name}>
              <Thumb w={w} />
              <div className="wc-body">
                <div className="wc-name">{w.name}</div>
                <div className="wc-meta">
                  <span>{w.author_name ?? '未知作者'}</span>
                  <span>{w.visits} 次 · {w.friends_seen} 人</span>
                </div>
                <div className="wc-meta">
                  <span>{fmt(w.last_at)}</span>
                  {w.capacity ? <span>容量 {w.capacity}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.has_more || offset > 0 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="chip" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            上一页
          </button>
          <span className="text-[12px] text-fg3">
            {offset + 1}–{offset + rows.length} / {data?.total ?? 0}
          </span>
          <button className="chip" disabled={!data?.has_more} onClick={() => setOffset(offset + LIMIT)}>
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
