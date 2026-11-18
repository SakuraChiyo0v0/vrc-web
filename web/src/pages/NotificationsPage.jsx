import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, send } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';

const TYPE_LABEL = {
  invite: '邀请',
  friend_request: '好友请求',
  request_invite: '邀我',
  group_announcement: '群公告',
  group_invite: '群邀请',
  instance: '实例',
  message: '消息'
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { openFriend } = useDrawer();
  const [unread, setUnread] = useState(false);
  const [type, setType] = useState('');

  const { data } = useQuery({
    queryKey: ['notifications', unread, type],
    queryFn: () => api(`notifications?unread=${unread ? 1 : 0}&type=${encodeURIComponent(type)}`)
  });
  const rows = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({
    mutationFn: (body) => send('notifications/read', 'POST', body),
    onSuccess: refresh
  });

  const types = ['', ...(data?.types ?? [])];

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button className="chip" data-active={!unread} onClick={() => setUnread(false)}>
          全部
        </button>
        <button className="chip" data-active={unread} onClick={() => setUnread(true)}>
          未读 {unreadCount > 0 ? `· ${unreadCount}` : ''}
        </button>
        <span className="mx-1 h-4 w-px" style={{ background: 'var(--stroke-subtle)' }} />
        {types.map((t) => (
          <button key={t || 'any'} className="chip" data-active={type === t} onClick={() => setType(t)}>
            {t ? TYPE_LABEL[t] ?? t : '全部类型'}
          </button>
        ))}
        <button
          className="chip ml-auto"
          disabled={unreadCount === 0 || markRead.isPending}
          onClick={() => markRead.mutate({ all: true })}
          style={unreadCount === 0 ? { opacity: 0.5, cursor: 'default' } : undefined}
        >
          {markRead.isPending ? '处理中…' : '全部标记已读'}
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty icon="bell" title={unread || type ? '这个筛选下没有通知' : '暂无通知'} hint={unread || type ? '换个类型或看全部通知。' : '邀请、好友请求、群公告会出现在这里。'} />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <div
              key={n.id}
              className="card flex items-start gap-3 px-4 py-3"
              style={n.seen ? undefined : { borderColor: 'var(--primary)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!n.seen && <span className="size-1.5 rounded-full" style={{ background: 'var(--primary)' }} />}
                  <span className="label-xs" style={{ color: 'var(--content-secondary)' }}>
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="text-[11px] text-fg3">
                    {n.created_at ? new Date(n.created_at).toLocaleString('zh-CN', { hour12: false }) : ''}
                  </span>
                </div>
                {n.sender_user_id ? (
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-[12px] hover:underline"
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                    data-sender={n.sender_user_id}
                    onClick={() => openFriend(n.sender_user_id)}
                  >
                    {n.sender_name ?? n.sender_user_id}
                  </button>
                ) : null}
                <div className="mt-1 text-[12px]" style={n.seen ? { color: 'var(--content-tertiary)' } : undefined}>
                  {n.message ?? n.link ?? '—'}
                </div>
                {n.link ? (
                  <a className="mt-1 inline-block text-[11px] text-fg3 hover:underline" href={n.link} target="_blank" rel="noreferrer">
                    打开链接
                  </a>
                ) : null}
              </div>
              {!n.seen && (
                <button
                  className="chip shrink-0"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate({ ids: [n.id] })}
                >
                  标为已读
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
