import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

const GROUPS = [
  {
    title: '实况',
    items: [
      { id: 'friends', label: '好友位置', icon: '◉' },
      { id: 'feed', label: '动态', icon: '≡' },
      { id: 'notifications', label: '通知', icon: '!' }
    ]
  },
  {
    title: '历史',
    items: [
      { id: 'sessions', label: '我的行程', icon: '◇' },
      { id: 'players', label: '玩家', icon: '☺' },
      { id: 'stats', label: '统计', icon: '▤' },
      { id: 'insights', label: '洞察', icon: '✧' },
      { id: 'favorites', label: '收藏', icon: '★' }
    ]
  },
  {
    title: '系统',
    items: [{ id: 'settings', label: '设置', icon: '⚙' }]
  }
];

/** 固定世界：名称 + 当前在里面的人数，点进去到收藏页 */
function PinnedWorlds({ onNavigate }) {
  const { data } = useQuery({ queryKey: ['pinned'], queryFn: () => api('pinned'), refetchInterval: 60_000 });
  const rows = data?.pinned ?? [];
  if (!rows.length) return null;
  return (
    <div className="border-t px-2.5 py-2" style={{ borderColor: 'var(--stroke-subtle)' }}>
      <div className="label-xs px-2 pb-1.5">固定世界</div>
      {rows.map((p) => (
        <button
          key={p.id}
          onClick={() => onNavigate('favorites')}
          title={p.note ? `${p.name} · ${p.note}` : p.name}
          className="nav-item mb-0.5 w-full text-left"
        >
          <span className="w-3.5 text-center text-[11px] opacity-60">★</span>
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          {p.online > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-[10.5px] tabular-nums text-fg3">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--status-joinme, #4ade80)' }} />
              {p.online}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default function Sidebar({ page, onNavigate, me, open = false, onClose }) {
  return (
    <aside
      className="vrc-sidebar flex w-52 shrink-0 flex-col border-r"
      data-open={open ? 'true' : 'false'}
      style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)' }}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div
          className="grid size-7 place-items-center rounded-[8px] text-[12px] font-medium"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--stroke-subtle)' }}
        >
          V
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium">{me?.display_name ?? 'VRC'}</div>
          <div className="truncate text-[10.5px] text-fg3">self-hosted panel</div>
        </div>
        {/* 33 只在移动端抽屉里出现 */}
        <button className="vrc-sidebar-close chip ml-auto" onClick={onClose} aria-label="关闭菜单">✕</button>
      </div>

      <nav className="flex flex-1 flex-col gap-5 px-2.5 py-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="label-xs px-2 pb-1.5">{g.title}</div>
            {g.items.map((it) => (
              <button
                key={it.id}
                onClick={() => onNavigate(it.id)}
                data-active={page === it.id}
                className="nav-item mb-0.5 w-full text-left"
              >
                <span className="w-3.5 text-center text-[11px] opacity-60">{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <PinnedWorlds onNavigate={onNavigate} />

      <div className="border-t px-4 py-3 text-[10.5px] leading-relaxed text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>
        数据来自 VRChat pipeline
        <br />
        NAS 常驻采集
      </div>
    </aside>
  );
}
