import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';

const STATUS_COLOR = {
  active: 'var(--status-active)',
  'join me': 'var(--status-joinme)',
  'ask me': 'var(--status-askme)',
  busy: 'var(--status-busy)',
  offline: 'var(--status-offline)'
};

/** 与好友页同一份 roster 数据，这里只做「右栏」这一种排法 */
const SECTIONS = [
  ['favorite', '已分组的好友'],
  ['online', '在线'],
  ['same_room', '同一房间'],
  ['active', '活跃中'],
  ['offline', '离线']
];

function dur(m) {
  const n = Number(m ?? 0);
  if (!n) return '';
  if (n < 60) return `${n}分钟`;
  if (n < 1440) return `${Math.floor(n / 60)}小时${n % 60 ? `${n % 60}分` : ''}`;
  return `${Math.floor(n / 1440)}天`;
}

function Row({ f }) {
  const { openFriend } = useDrawer();
  const color = STATUS_COLOR[f.status] ?? 'var(--status-offline)';
  const where = f.online
    ? `${f.region ? `${String(f.region).toUpperCase()} ` : ''}${f.world_name ?? '未知世界'}·${f.access_label ?? '公开'}`
    : '离线';
  return (
    <div className="roster-row" onClick={() => openFriend(f.user_id)} title={where}>
      <UserHoverCard id={f.user_id}>
        <span className="avatar">
          {f.icon_url ? (
            <img
              src={imgUrl(f.icon_url)}
              alt=""
              loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
          ) : null}
          <span className="dot" style={{ background: color }} />
        </span>
      </UserHoverCard>
      <span className="min-w-0 flex-1">
        <span className="roster-name">{f.display_name ?? f.user_id}</span>
        <span className="roster-meta">
          {where}
          {f.online && dur(f.online_minutes) ? ` · ${dur(f.online_minutes)}` : ''}
        </span>
      </span>
    </div>
  );
}

/**
 * 76 右侧常驻好友面板（非好友页显示，可折叠成一条 32px 竖条）。
 * 分组标题带计数，来自 /api/roster facets；点人开抽屉，不跳页。
 */
export default function RosterPanel() {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vrc-roster-collapsed') === '1');
  const { data } = useQuery({ queryKey: ['roster'], queryFn: () => api('roster'), refetchInterval: 30_000 });
  const facets = data?.facets ?? {};

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('vrc-roster-collapsed', v ? '0' : '1');
      return !v;
    });
  };

  // 一人只出现在一个分组：收藏优先，其次在线，再按状态/离线
  const sections = useMemo(() => {
    const friends = (data?.friends ?? []).filter((f) =>
      !q ? true : (f.display_name ?? '').toLowerCase().includes(q.toLowerCase()));
    const taken = new Set();
    const match = (key, f) => {
      if (key === 'favorite') return f.favorite;
      if (key === 'online') return f.online;
      if (key === 'same_room') return f.same_room;
      if (key === 'active') return f.active;
      return !f.online;
    };
    return SECTIONS.map(([key, label]) => {
      const rows = friends.filter((f) => !taken.has(f.user_id) && match(key, f));
      rows.forEach((f) => taken.add(f.user_id));
      return { key, label, count: facets[key] ?? 0, rows };
    }).filter((s) => s.rows.length > 0 || (s.key !== 'same_room' && s.key !== 'active' && !q));
  }, [data, q, facets]);

  if (collapsed) {
    return (
      <aside className="roster-rail" data-collapsed="true" data-testid="roster-rail">
        <button className="roster-toggle" onClick={toggle} title="展开好友面板" aria-label="展开好友面板">‹</button>
        <span className="roster-spine">好友 {facets.online ?? 0}</span>
      </aside>
    );
  }

  return (
    <aside className="roster-rail" data-collapsed="false" data-testid="roster-rail">
      <div className="roster-head">
        <span className="text-[12px] font-medium">好友</span>
        <span className="tabular-nums text-[11px] text-fg3">在线 {facets.online ?? 0}</span>
        <button className="roster-toggle ml-auto" onClick={toggle} title="折叠好友面板" aria-label="折叠好友面板">›</button>
      </div>
      <div className="px-2 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="筛选好友"
          className="h-7 w-full rounded-lg border px-2 text-[12px] outline-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-raised)', color: 'var(--content-primary)' }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {sections.map((s) => (
          <section key={s.key} data-section={s.key}>
            <div className="group-head">
              <span className="truncate font-medium">{s.label}</span>
              <span className="shrink-0 tabular-nums text-fg3">{s.count}</span>
            </div>
            {s.rows.map((f) => <Row key={f.user_id} f={f} />)}
          </section>
        ))}
        {sections.every((s) => s.rows.length === 0) ? (
          <div className="px-3 py-4 text-[11px] text-fg3">{q ? '没有匹配的好友' : '暂无好友数据'}</div>
        ) : null}
      </div>
    </aside>
  );
}
