import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

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

/** 41 世界库：所有去过的世界，搜索 + 按最近活跃/访问次数排序，点进详情 */
export default function WorldsPage() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [offset, setOffset] = useState(0);
  const { openWorld } = useDrawer();
  const LIMIT = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['worlds', q, sort, offset],
    queryFn: () => api(`worlds?q=${encodeURIComponent(q)}&sort=${sort}&limit=${LIMIT}&offset=${offset}`),
  });

  const rows = data?.worlds ?? [];

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
        <button className="chip" data-active={sort === 'recent'} onClick={() => { setSort('recent'); setOffset(0); }}>
          最近活跃
        </button>
        <button className="chip" data-active={sort === 'visits'} onClick={() => { setSort('visits'); setOffset(0); }}>
          访问次数
        </button>
        <span className="chip sm:ml-auto">共 {data?.total ?? 0} 个世界</span>
      </div>

      {isLoading ? (
        <div className="text-[12px] text-fg3">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">还没有去过的世界</div>
          <div className="mt-1 text-[12px] text-fg3">采集器记录到自己进出世界后会出现在这里。</div>
        </div>
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
