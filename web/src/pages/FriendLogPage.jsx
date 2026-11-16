import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

/** 73 好友历史：全好友流水（事件 / 资料变更 / 状态），可按人、类型、时间窗过滤 */
export default function FriendLogPage() {
  const [hours, setHours] = useState(24);
  const [kind, setKind] = useState('');
  const [userId, setUserId] = useState('');
  const { openFriend } = useDrawer();

  const { data: list } = useQuery({ queryKey: ['friend-list', 'for-log'], queryFn: () => api('friend-list?sort=name') });
  const params = new URLSearchParams({ hours: String(hours), limit: '300' });
  if (kind) params.set('kind', kind);
  if (userId) params.set('user_id', userId);
  const { data, isLoading } = useQuery({
    queryKey: ['friend-log', hours, kind, userId],
    queryFn: () => api(`friend-log?${params.toString()}`),
    refetchInterval: 60_000
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const kinds = useMemo(() => Object.entries(counts).sort((a, b) => b[1] - a[1]), [counts]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value={6}>近 6 小时</option>
          <option value={24}>近 24 小时</option>
          <option value={72}>近 3 天</option>
          <option value={168}>近 7 天</option>
        </select>
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={kind} onChange={(e) => setKind(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部类型</option>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}{counts[k] ? ` (${counts[k]})` : ''}</option>
          ))}
        </select>
        <select className="h-8 max-w-[180px] rounded-lg border px-2 text-[12px]" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部好友</option>
          {(list?.friends ?? []).map((f) => (
            <option key={f.user_id} value={f.user_id}>{f.display_name}</option>
          ))}
        </select>
        <span className="text-[12px] text-fg3">
          {data?.total ?? 0} 条 · {data?.people ?? 0} 人
        </span>
        {kinds.length ? (
          <span className="hidden gap-1.5 sm:flex">
            {kinds.map(([k, n]) => <span key={k} className="chip">{KIND_LABEL[k] ?? k} {n}</span>)}
          </span>
        ) : null}
      </div>

      {isLoading ? <div className="text-[12px] text-fg3">加载中…</div> : null}

      {!isLoading && items.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">这个时间窗里没有记录</div>
          <div className="mt-1 text-[12px] text-fg3">放大时间窗或取消筛选再看看。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col p-1">
            {items.map((i) => (
              <div key={i.id} className="friend-row" onClick={() => openFriend(i.user_id)}>
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
          {data && data.total > items.length ? (
            <div className="border-t px-3 py-2 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>
              只显示最近 {items.length} 条（共 {data.total} 条）
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
