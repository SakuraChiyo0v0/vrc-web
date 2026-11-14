import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export default function NotificationsPage() {
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api('notifications') });
  const rows = data?.notifications ?? [];
  return (
    <div className="p-4">
      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[13px]">暂无通知</div>
          <div className="mt-1 text-[11.5px] text-fg3">邀请、好友请求、群公告会出现在这里。</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <div key={n.id} className="card px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="label-xs" style={{ color: 'var(--content-secondary)' }}>{n.type}</span>
                <span className="text-[10.5px] text-fg3">
                  {n.created_at ? new Date(n.created_at).toLocaleString('zh-CN', { hour12: false }) : ''}
                </span>
              </div>
              <div className="mt-1 text-[12.5px]">{n.message ?? n.link ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
