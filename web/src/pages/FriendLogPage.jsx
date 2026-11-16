import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

const KIND_LABEL = {
  online: '上线',
  offline: '下线',
  location: '换世界',
  profile: '资料',
  status: '状态'
};

const fg = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const t = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? t : `${d.getMonth() + 1}/${d.getDate()} ${t}`;
};

/**
 * 73 好友历史：全好友流水（事件 / 资料变更 / 状态）。
 * 89 打磨：倒序流水 + 类型多选 + 游标分页（每页 100，按 at|id 游标翻页，不重复）。
 */
export default function FriendLogPage() {
  const [hours, setHours] = useState(24);
  const [kinds, setKinds] = useState([]);
  const [userId, setUserId] = useState('');
  const { openFriend } = useDrawer();

  const { data: list } = useQuery({ queryKey: ['friend-list', 'for-log'], queryFn: () => api('friend-list?sort=name') });

  const baseParams = useMemo(() => {
    const p = new URLSearchParams({ hours: String(hours), limit: '100' });
    if (kinds.length) p.set('kinds', kinds.join(','));
    if (userId) p.set('user_id', userId);
    return p.toString();
  }, [hours, kinds, userId]);

  const q = useInfiniteQuery({
    queryKey: ['friend-log', baseParams],
    queryFn: ({ pageParam }) => api(`friend-log?${baseParams}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 60_000
  });

  const pages = q.data?.pages ?? [];
  // 多页拼接时按 id 去重：游标在同一毫秒被截断也不会出现重复行
  const items = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of pages) {
      for (const i of p.items ?? []) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        out.push(i);
      }
    }
    return out;
  }, [pages]);

  const counts = pages[0]?.counts ?? {};
  const total = pages[0]?.total ?? 0;
  const toggleKind = (k) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  return (
    <div className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value={6}>近 6 小时</option>
          <option value={24}>近 24 小时</option>
          <option value={72}>近 3 天</option>
          <option value={168}>近 7 天</option>
        </select>
        <select className="h-8 max-w-[180px] rounded-lg border px-2 text-[12px]" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部好友</option>
          {(list?.friends ?? []).map((f) => (
            <option key={f.user_id} value={f.user_id}>{f.display_name}</option>
          ))}
        </select>
        <span className="text-[12px] text-fg3" data-total={total}>
          {total} 条 · {pages[0]?.people ?? 0} 人
        </span>
        {kinds.length ? (
          <button className="chip" data-reset="1" onClick={() => setKinds([])}>清空类型</button>
        ) : null}
      </div>

      {/* 89 类型多选：计数取整段时间窗（不受勾选影响），点一下加一项 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="按类型筛选">
        {Object.keys(KIND_LABEL).map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              className="chip kind-chip"
              data-kind={k}
              data-on={on ? '1' : '0'}
              aria-pressed={on}
              onClick={() => toggleKind(k)}
              style={on ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
            >
              {KIND_LABEL[k]} <span className="tabular-nums text-fg3">{counts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {q.isLoading ? <div className="text-[12px] text-fg3">加载中…</div> : null}

      {!q.isLoading && items.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">这个时间窗里没有记录</div>
          <div className="mt-1 text-[12px] text-fg3">放大时间窗或取消筛选再看看。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col p-1">
            {items.map((i) => (
              <div key={i.id} className="friend-row" onClick={() => openFriend(i.user_id)} data-id={i.id}>
                <span className="avatar">
                  {i.icon_url ? <img src={imgUrl(i.icon_url)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                </span>
                <span className="w-24 shrink-0 truncate">{i.display_name ?? i.user_id}</span>
                <span className="w-14 shrink-0 text-[11px] text-fg3">{KIND_LABEL[i.kind] ?? i.kind}</span>
                <span className="min-w-0 flex-1 truncate text-fg2">{i.text ?? ''}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-fg3">{fg(i.at)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>
            <span>已显示 {items.length} / {total} 条</span>
            {q.hasNextPage ? (
              <button
                className="chip"
                data-more="1"
                disabled={q.isFetchingNextPage}
                onClick={() => q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? '加载中…' : '加载更多'}
              </button>
            ) : total > 0 ? <span>· 已经到底</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}
