import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, BASE } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

const KIND = {
  online: ['上线', 'var(--status-online)'],
  active: ['活跃', 'var(--status-active)'],
  offline: ['下线', 'var(--status-offline)'],
  location: ['换房', 'var(--status-joinme)'],
  profile: ['资料变更', 'var(--content-secondary)'],
  friend_add: ['加好友', 'var(--status-online)'],
  friend_delete: ['删好友', 'var(--status-busy)'],
  self_profile: ['自己变更', 'var(--content-tertiary)']
};

const KINDS = [['', '全部'], ['online', '上线'], ['location', '换房'], ['offline', '下线'], ['active', '活跃'], ['profile', '资料变更']];
const RANGES = [['', '不限时间'], ['1h', '1 小时'], ['24h', '24 小时'], ['7d', '7 天']];
const LIMIT = 80;

function sinceFor(range) {
  const now = Date.now();
  if (range === '1h') return new Date(now - 3600_000).toISOString();
  if (range === '24h') return new Date(now - 86400_000).toISOString();
  if (range === '7d') return new Date(now - 7 * 86400_000).toISOString();
  return '';
}

export default function FeedPage() {
  const [kind, setKind] = useState('');
  const [range, setRange] = useState('');
  const { openWorld, openFriend } = useDrawer();

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['events', kind, range],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api(`events?kind=${encodeURIComponent(kind)}&since=${encodeURIComponent(sinceFor(range))}&limit=${LIMIT}&offset=${pageParam}`),
    getNextPageParam: (last, pages) => (last?.has_more ? pages.length * LIMIT : undefined)
  });

  const events = (data?.pages ?? []).flatMap((p) => p.events ?? []);

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {KINDS.map(([v, label]) => (
        <button key={v || 'all'} onClick={() => setKind(v)} className="chip" data-active={kind === v}>
          {label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: 'var(--stroke-subtle)' }} />
      {RANGES.map(([v, label]) => (
        <button key={v || 'any'} onClick={() => setRange(v)} className="chip" data-active={range === v}>
          {label}
        </button>
      ))}
      <a className="chip ml-auto" href={`${BASE}api/export/events.csv`} download>
        导出 CSV
      </a>
    </div>
  );

  if (isLoading) return <div className="p-4 text-[12px] text-fg3">加载中…</div>;

  if (!events.length) {
    return (
      <div className="p-4">
        {toolbar}
        <div className="card p-10 text-center">
          <div className="text-[13px]">{kind || range ? '这个筛选下没有事件' : '还没有事件'}</div>
          <div className="mt-1 text-[11.5px] text-fg3">
            {kind || range ? '换个事件类型或时间范围试试。' : '采集器连上 pipeline 后，好友上下线和换房会实时出现在这里。'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {toolbar}
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 150 }}>时间</th>
              <th style={{ width: 90 }}>事件</th>
              <th>玩家</th>
              <th>世界</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const [label, color] = KIND[e.kind] ?? [e.kind, 'var(--content-secondary)'];
              return (
                <tr key={e.id}>
                  <td className="text-[11.5px] text-fg3">{new Date(e.at).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: color }} />
                      <span style={{ color }}>{label}</span>
                    </span>
                  </td>
                  <td>
                    <button
                      className="inline-flex items-center gap-2 text-left"
                      onClick={() => (e.user_id ? openFriend(e.user_id) : null)}
                      style={{ cursor: e.user_id ? 'pointer' : 'default' }}
                    >
                      <span className="avatar" style={{ width: 22, height: 22 }}>
                        {e.icon_url ? <img src={e.icon_url} alt="" loading="lazy" style={{ borderRadius: 5 }} /> : null}
                      </span>
                      {e.display_name ?? e.user_id ?? '—'}
                    </button>
                  </td>
                  <td className="text-fg2">
                    {e.world_id ? (
                      <button className="truncate text-left hover:underline" onClick={() => openWorld(e.world_id)}>
                        {e.world_name ?? e.world_id}
                      </button>
                    ) : (
                      e.world_name ?? (e.location === 'private' ? '私密世界' : e.location === 'offline' ? '—' : e.location ?? '—')
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {hasNextPage ? (
          <button className="chip" onClick={() => fetchNextPage()} disabled={isFetching}>
            {isFetching ? '加载中…' : '加载更多'}
          </button>
        ) : (
          <span className="text-[11px] text-fg3">共 {events.length} 条，到底了</span>
        )}
      </div>
    </div>
  );
}
