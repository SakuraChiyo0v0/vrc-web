import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';
import { matchText } from '../lib/pinyin.js';

const MIN_W = 200;
const MAX_W = 420;
const DEF_W = 244;
const W_KEY = 'vrc-roster-w';

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
  // 93 宽度记忆：默认 244，可拖到 200–420，双击复位
  const [w, setW] = useState(() => {
    const v = Number(localStorage.getItem(W_KEY));
    return Number.isFinite(v) && v >= MIN_W && v <= MAX_W ? v : DEF_W;
  });
  const wRef = useRef(w);
  wRef.current = w;
  const [dragging, setDragging] = useState(false);
  const { data } = useQuery({ queryKey: ['roster'], queryFn: () => api('roster'), refetchInterval: 30_000 });
  const facets = data?.facets ?? {};

  // 往左拖变宽：width = 视口右边缘 − 指针 x；松手才落 localStorage（避免每帧写盘）
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => setW(Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX)));
    const up = () => {
      setDragging(false);
      localStorage.setItem(W_KEY, String(Math.round(wRef.current)));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  const resetW = () => {
    setW(DEF_W);
    localStorage.setItem(W_KEY, String(DEF_W));
  };

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem('vrc-roster-collapsed', v ? '0' : '1');
      return !v;
    });
  };

  // 一人只出现在一个分组：收藏优先，其次在线，再按状态/离线
  const sections = useMemo(() => {
    const friends = (data?.friends ?? []).filter((f) =>
      matchText(f.display_name, q));
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
    <aside
      className="roster-rail"
      data-collapsed="false"
      data-testid="roster-rail"
      data-width={w}
      style={{ width: `${w}px`, flexBasis: `${w}px` }}
    >
      {/* 93 左边缘拖宽手柄（双击复位 244） */}
      <div
        className="roster-resize"
        data-testid="roster-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整好友面板宽度"
        title="拖动改宽 · 双击复位"
        onPointerDown={(e) => { e.preventDefault(); setDragging(true); }}
        onDoubleClick={resetW}
        data-dragging={dragging ? 'true' : 'false'}
      />
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
