import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

function Thumb({ w }) {
  return (
    <span
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[7px] text-[11px]"
      style={{ background: 'var(--surface-raised)', color: 'var(--content-tertiary)' }}
    >
      {w.thumbnail ? <img src={imgUrl(w.thumbnail)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (w.name ?? '?').slice(0, 1)}
    </span>
  );
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
          <div className="text-[13px]">还没有去过的世界</div>
          <div className="mt-1 text-[11.5px] text-fg3">采集器记录到自己进出世界后会出现在这里。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>世界</th>
                <th style={{ width: 96 }}>到访</th>
                <th style={{ width: 110 }}>遇见好友</th>
                <th style={{ width: 190 }}>最近一次</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} onClick={() => openWorld(w.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Thumb w={w} />
                      <span className="min-w-0">
                        <span className="block truncate">{w.name}</span>
                        <span className="block truncate text-[10.5px] text-fg3">
                          {w.author_name ?? '未知作者'}
                          {w.capacity ? ` · 容量 ${w.capacity}` : ''}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="tabular-nums text-fg2">{w.visits} 次</td>
                  <td className="tabular-nums text-fg2">{w.friends_seen} 人</td>
                  <td className="text-[11.5px] text-fg3">{fmt(w.last_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.has_more || offset > 0 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="chip" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            上一页
          </button>
          <span className="text-[11.5px] text-fg3">
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
