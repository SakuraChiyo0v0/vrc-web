import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

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

export default function FeedPage() {
  const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => api('events?limit=150') });
  if (isLoading) return <div className="p-4 text-[12px] text-fg3">加载中…</div>;
  const events = data?.events ?? [];

  if (!events.length) {
    return (
      <div className="p-4">
        <div className="card p-10 text-center">
          <div className="text-[13px]">还没有事件</div>
          <div className="mt-1 text-[11.5px] text-fg3">采集器连上 pipeline 后，好友上下线和换房会实时出现在这里。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
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
                    <span className="inline-flex items-center gap-2">
                      <span className="avatar" style={{ width: 22, height: 22 }}>
                        {e.icon_url ? <img src={e.icon_url} alt="" loading="lazy" style={{ borderRadius: 5 }} /> : null}
                      </span>
                      {e.display_name ?? e.user_id ?? '—'}
                    </span>
                  </td>
                  <td className="text-fg2">{e.world_name ?? (e.location === 'private' ? '私密世界' : e.location === 'offline' ? '—' : e.location ?? '—')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
