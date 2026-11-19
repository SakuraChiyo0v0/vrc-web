import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, send } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import { groupByType, groupSummary } from '../lib/notifGroups.js';

const TYPE_LABEL = {
  invite: '邀请',
  friend_request: '好友请求',
  request_invite: '邀我',
  group_announcement: '群公告',
  group_invite: '群邀请',
  instance: '实例',
  message: '消息'
};

/** 单条通知卡片（聚合条展开后也是它） */
function NoteRow({ n, open, onToggle, onRead, onOpenFriend, pending }) {
  return (
    <div
      className="card flex items-start gap-3 px-4 py-3"
      style={n.seen ? undefined : { borderColor: 'var(--primary)' }}
      data-notif-id={n.id}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {!n.seen && <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--primary)' }} />}
          <span className="label-xs shrink-0" style={{ color: 'var(--content-secondary)' }}>
            {TYPE_LABEL[n.type] ?? n.type}
          </span>
          <span className="whitespace-nowrap text-[11px] text-fg3">
            {n.created_at ? new Date(n.created_at).toLocaleString('zh-CN', { hour12: false }) : ''}
          </span>
          {/* 104 同类型 24h 内合并：带计数，可展开看每一条 */}
          {n.count > 1 ? (
            <button
              className="chip h-5 shrink-0 whitespace-nowrap px-1.5 text-[11px] tabular-nums"
              data-agg={n.count}
              onClick={() => onToggle(n.id)}
              title={open ? '收起' : '展开全部'}
            >
              ×{n.count} {open ? '收起' : '展开'}
            </button>
          ) : null}
          {n.count > 1 && n.unseen > 0 ? (
            <span className="whitespace-nowrap text-[11px] text-fg3">未读 {n.unseen}</span>
          ) : null}
        </div>
        {n.sender_user_id ? (
          <button
            className="mt-1 inline-flex items-center gap-1 text-[12px] hover:underline"
            style={{ color: 'var(--primary)', cursor: 'pointer' }}
            data-sender={n.sender_user_id}
            onClick={() => onOpenFriend(n.sender_user_id)}
          >
            {n.sender_name ?? n.sender_user_id}
          </button>
        ) : null}
        <div className="mt-1 text-[12px]" style={n.seen ? { color: 'var(--content-tertiary)' } : undefined}>
          {n.message ?? n.link ?? '—'}
        </div>
        {n.count > 1 && open ? (
          <div className="mt-1.5 flex flex-col gap-1 border-l pl-2" style={{ borderColor: 'var(--stroke-subtle)' }} data-agg-list={n.id}>
            {n.items.map((it) => (
              <div key={it.id} className="flex items-start gap-2 text-[11px] text-fg3">
                <span className="shrink-0 tabular-nums">
                  {it.created_at ? new Date(it.created_at).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span className="min-w-0 flex-1 truncate">{it.message ?? it.link ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : null}
        {n.link ? (
          <a className="mt-1 inline-block text-[11px] text-fg3 hover:underline" href={n.link} target="_blank" rel="noreferrer">
            打开链接
          </a>
        ) : null}
      </div>
      {!n.seen && (
        <button className="chip shrink-0" disabled={pending} onClick={() => onRead(n.ids ?? [n.id])}>
          标为已读
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { openFriend } = useDrawer();
  const [unread, setUnread] = useState(false);
  const [type, setType] = useState('');
  // 104 聚合卡展开：只存被展开的组 id
  const [open, setOpen] = useState([]);
  const toggleOpen = (id) => setOpen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  // 117 按类型分组折叠：只存被手动切换过的类型，其余用「有未读就摊开」的默认
  const [folded, setFolded] = useState({});

  const { data } = useQuery({
    queryKey: ['notifications', unread, type],
    queryFn: () => api(`notifications?unread=${unread ? 1 : 0}&type=${encodeURIComponent(type)}`)
  });
  const rows = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;
  const groups = groupByType(rows);

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
        <div className="flex flex-col gap-2" data-notif-groups={groups.length}>
          {groups.map((g) => {
            const opened = folded[g.type] ?? g.opened;
            return (
              <section
                key={g.type}
                className="card overflow-hidden"
                data-type-group={g.type}
                data-group-count={g.count}
                data-group-open={opened ? '1' : '0'}
              >
                {/* 117 组头：点一下折叠/展开整类 */}
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  data-group-toggle={g.type}
                  aria-expanded={opened}
                  onClick={() => setFolded((cur) => ({ ...cur, [g.type]: !opened }))}
                >
                  <span className="shrink-0 text-[11px] text-fg3">{opened ? '▾' : '▸'}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-fg3">
                    {groupSummary(g, TYPE_LABEL)}
                  </span>
                  {g.unseen > 0 ? (
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--primary)' }} />
                  ) : null}
                </button>
                {opened ? (
                  <div className="flex flex-col gap-2 border-t px-2 py-2" style={{ borderColor: 'var(--stroke-subtle)' }}>
                    {g.items.map((n) => (
                      <NoteRow
                        key={n.id}
                        n={n}
                        open={open.includes(n.id)}
                        onToggle={toggleOpen}
                        onRead={(ids) => markRead.mutate({ ids })}
                        onOpenFriend={openFriend}
                        pending={markRead.isPending}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
