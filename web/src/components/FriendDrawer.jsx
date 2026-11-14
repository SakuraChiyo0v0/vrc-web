import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import { useDrawer } from './drawers.jsx';

const KIND = {
  online: '上线',
  active: '活跃',
  offline: '下线',
  location: '换房',
  profile: '资料变更',
  friend_add: '加好友',
  friend_delete: '删好友'
};

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

function locLabel(p) {
  if (!p?.location) return '未知';
  if (p.location === 'offline') return '离线';
  if (p.location === 'private') return '私密世界';
  if (p.location === 'traveling') return '切换中';
  return p.world_name || p.location;
}

/** 好友详情抽屉：资料 / 最近事件 / 常一起出现的世界 */
export default function FriendDrawer({ id, onClose }) {
  const { openWorld } = useDrawer();
  const { data, isLoading, error } = useQuery({ queryKey: ['friend', id], queryFn: () => api(`friend/${encodeURIComponent(id)}`) });
  const p = data?.profile;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,.28)' }} onClick={onClose}>
      <aside
        className="flex h-full w-[400px] max-w-[92vw] flex-col gap-3 overflow-auto border-l p-4"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="avatar" style={{ width: 40, height: 40 }}>
              {p?.icon_url ? <img src={imgUrl(p.icon_url)} alt="" loading="lazy" /> : null}
            </span>
            <div className="min-w-0">
              <div className="label-xs">好友</div>
              <div className="truncate text-[14px] font-medium">{p?.display_name ?? id}</div>
              <div className="truncate text-[11px] text-fg3">{locLabel(p)}</div>
            </div>
          </div>
          <button className="chip" onClick={onClose}>关闭</button>
        </div>

        {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}
        {error && <div className="card p-4 text-[12px] text-fg3">读不到这个好友：{error.message}</div>}

        {data ? (
          <>
            <div className="card px-3 py-2 text-[12px] leading-relaxed">
              <div className="flex justify-between gap-3"><span className="text-fg3">状态</span><span className="truncate">{p?.status ?? '—'}{p?.status_description ? `「${p.status_description}」` : ''}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">平台</span><span>{p?.platform ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">信任等级</span><span>{p?.trust_level ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">同房次数</span><span className="tabular-nums">{data.meets ?? 0}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">最近更新</span><span>{fmt(p?.updated_at)}</span></div>
            </div>

            <div>
              <div className="label-xs mb-1.5">常一起出现的世界</div>
              {(data.worlds ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[11.5px] text-fg3">还没有共同出现过的世界。</div>
              ) : (
                (data.worlds ?? []).map((w) => (
                  <button
                    key={w.world}
                    onClick={() => w.world_id && openWorld(w.world_id)}
                    className="card mb-1 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--state-hover-surface)]"
                  >
                    <span className="min-w-0 truncate text-[12.5px]">{w.world}</span>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-fg3">{w.meets} 次</span>
                  </button>
                ))
              )}
            </div>

            <div>
              <div className="label-xs mb-1.5">最近事件</div>
              {(data.events ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[11.5px] text-fg3">这个好友还没有事件记录。</div>
              ) : (
                (data.events ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-1 py-1 text-[11.5px]">
                    <span className="flex items-center gap-2">
                      <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>{KIND[e.kind] ?? e.kind}</span>
                      <span className="truncate text-fg2">{e.world_name ?? e.location ?? '—'}</span>
                    </span>
                    <span className="shrink-0 text-fg3">{fmt(e.at)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
