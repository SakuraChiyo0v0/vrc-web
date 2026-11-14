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
      { id: 'stats', label: '统计', icon: '▤' }
    ]
  }
];

export default function Sidebar({ page, onNavigate, me }) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r" style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)' }}>
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

      <div className="border-t px-4 py-3 text-[10.5px] leading-relaxed text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>
        数据来自 VRChat pipeline
        <br />
        NAS 常驻采集
      </div>
    </aside>
  );
}
