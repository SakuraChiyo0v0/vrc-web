import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';

/**
 * 房内玩家，对齐真机 docs/ref/vrcx0-players.png：
 * VRChat 没在运行时整页只有空态（VR 头显图标 + 标题 + 两行说明），没有工具栏和表格。
 * 「谁和我同一个实例」取自 /api/roster 的 my_world_id + same_room（好友维度，实时）；
 * 非好友玩家要 VRChat 在线接口，本地采集器拿不到，不列。
 * 历史同房记录（原「玩家」表）挪到 #/moderation（玩家管理）。
 */
export default function PlayersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['roster-same-room'],
    queryFn: () => api('roster'),
    refetchInterval: 30_000,
  });
  // 「VRChat 在运行」= 采集器 WS 还连着 VRChat；断连时实例信息是上一次的残留，不能当房内玩家
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('status'), refetchInterval: 15_000 });
  const { openFriend } = useDrawer();
  const live = Boolean(data?.my_world_id) && Boolean(status?.collector?.connected);
  const rows = (data?.friends ?? []).filter((f) => f.same_room);

  if (isLoading) return <div className="p-4 text-[12px] text-fg3">加载中…</div>;

  if (!live) {
    return (
      <div className="grid h-full place-items-center p-4" data-page="players">
        <Empty
          icon="vr"
          title="VRChat 目前没有运行"
          hint="启动 VRChat 并进入一个房间后，这里会显示同一房间的玩家；有人加入或离开时，列表也会自动更新。"
        />
      </div>
    );
  }

  return (
    <div className="p-4" data-page="players">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[13px] font-medium">同一房间</span>
        <span className="text-[11px] tabular-nums text-fg3" data-count={rows.length}>{rows.length} 位好友</span>
      </div>
      {rows.length === 0 ? (
        <Empty compact icon="users" title="这个房间里还没有好友" hint="只统计好友；其他玩家需要 VRChat 在线接口，采集器拿不到。" />
      ) : (
        <div className="world-grid" data-grid="room-players">
          {rows.map((p) => (
            <div
              key={p.user_id}
              className="card flex items-center gap-2.5 p-2.5"
              data-room-player={p.user_id}
              onClick={() => openFriend(p.user_id)}
            >
              <span className="avatar">
                {p.icon_url ? <img src={imgUrl(p.icon_url)} alt="" loading="lazy" /> : (p.display_name ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px]">{p.display_name}</span>
                <span className="block truncate text-[11px] text-fg3">{p.status_description || p.world_name || '同房间'}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
