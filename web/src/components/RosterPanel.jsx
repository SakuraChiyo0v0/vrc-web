import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';
import { matchText } from '../lib/pinyin.js';

// 187 尺寸全部来自真机量测 docs/ref/vrcx0-spec.json → chrome.rail（scripts/measure_ref_rail.py）：
// 栏宽 353 / resizer 10 / 自身账号卡 59 / 头像 57 / 筛选框 30 / 右侧图标竖条 36 / 行距 60 / 分组标题 21
// 真机 CSS 是 320px、截图 UI 缩放 110%，所以 353 是「设备像素」口径，与外壳 277/39/35 一致。
const MIN_W = 264;   // 真机 clamp 240 CSS ×1.1
const MAX_W = 770;   // 真机 clamp 700 CSS ×1.1
const DEF_W = 353;
const W_KEY = 'vrc-roster-w';

const STATUS_COLOR = {
  active: 'var(--status-active)',
  'join me': 'var(--status-joinme)',
  'ask me': 'var(--status-askme)',
  busy: 'var(--status-busy)',
  offline: 'var(--status-offline)'
};

/** 与好友页同一份 roster 数据，这里只做「右栏」这一种排法（分组顺序照真机 SidePanel） */
const SECTIONS = [
  ['favorite', '已分组的好友'],
  ['same_room', '同一房间'],
  ['online', '在线'],
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
 * 187 右栏好友面板：真机 VRCX-0 SidePanel 的结构——
 * 自身账号卡（头像/名字/状态/⋯）→ 筛选框（内嵌放大镜）→ 分组列表 → 右侧 36px 图标竖条（带计数）。
 * 可折叠成 36px 竖条；宽度可拖，记忆在 localStorage。
 */
export default function RosterPanel() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vrc-roster-collapsed') === '1');
  // 93 宽度记忆：默认 353（真机量测），可拖到 264–770，双击复位
  const [w, setW] = useState(() => {
    const v = Number(localStorage.getItem(W_KEY));
    return Number.isFinite(v) && v >= MIN_W && v <= MAX_W ? v : DEF_W;
  });
  const wRef = useRef(w);
  wRef.current = w;
  const [dragging, setDragging] = useState(false);
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('status'), refetchInterval: 15_000 });
  const { data } = useQuery({ queryKey: ['roster'], queryFn: () => api('roster'), refetchInterval: 30_000 });
  const facets = data?.facets ?? {};
  const me = status?.account;

  // 往左拖变宽：width = 内容面板右缘 − 指针 x；松手才落 localStorage（避免每帧写盘）
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const panelRight = document.querySelector('.workspace')?.getBoundingClientRect().right ?? window.innerWidth;
      setW(Math.min(MAX_W, Math.max(MIN_W, panelRight - e.clientX)));
    };
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

  // 一人只出现在一个分组：收藏优先，其次同一房间，再在线/活跃/离线
  const sections = useMemo(() => {
    const friends = (data?.friends ?? [])
      .filter((f) => (tab === 'favorite' ? f.favorite : true))
      .filter((f) => matchText(f.display_name, q));
    const taken = new Set();
    const match = (key, f) => {
      if (key === 'favorite') return f.favorite;
      if (key === 'same_room') return f.same_room;
      if (key === 'online') return f.online;
      if (key === 'active') return f.active;
      return !f.online;
    };
    return SECTIONS.map(([key, label]) => {
      const rows = friends.filter((f) => !taken.has(f.user_id) && match(key, f));
      rows.forEach((f) => taken.add(f.user_id));
      return { key, label, count: facets[key] ?? 0, rows };
    }).filter((s) => s.rows.length > 0 || (s.key !== 'same_room' && s.key !== 'active' && !q));
  }, [data, q, tab, facets]);

  if (collapsed) {
    return (
      <aside className="roster-rail" data-collapsed="true" data-testid="roster-rail">
        <button className="roster-toggle" onClick={toggle} title="展开好友面板" aria-label="展开好友面板">‹</button>
        <span className="roster-spine">好友 {facets.online ?? 0}</span>
      </aside>
    );
  }

  const tabs = [
    { key: 'all', icon: '👥', count: facets.online ?? 0, label: '好友' },
    { key: 'favorite', icon: '★', count: facets.favorite ?? 0, label: '收藏' }
  ];

  return (
    <aside
      className="roster-rail"
      data-collapsed="false"
      data-testid="roster-rail"
      data-width={w}
      style={{ width: `${w}px`, flexBasis: `${w}px` }}
    >
      {/* 93 拖宽手柄：真机 10px 轨道 + 居中 1px 分割线（截图量到 x1323 / 宽10） */}
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
      <div className="roster-body">
        {/* 自身账号卡（真机 h59） */}
        <div className="roster-self" data-testid="roster-self">
          <span className="roster-self-avatar">
            {me?.icon_url ? (
              <img src={imgUrl(me.icon_url)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
            ) : null}
            <span className="dot" style={{ background: 'var(--status-active)' }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="roster-self-name">{me?.display_name ?? '未登录'}</span>
            <span className="roster-self-status">{status?.online ? '在线' : '离线'}</span>
          </span>
          <button className="roster-self-menu" onClick={toggle} title="折叠好友面板" aria-label="折叠好友面板">⋯</button>
        </div>

        {/* 筛选框（真机 h30，放大镜在右端） */}
        <div className="roster-filter" data-testid="roster-filter">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="筛选好友"
            className="h-full w-full bg-transparent text-[12px] outline-none"
            style={{ color: 'var(--content-primary)' }}
          />
          <span className="roster-filter-icon" aria-hidden="true">⌕</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto pb-2" data-testid="roster-list">
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
      </div>

      {/* 右侧图标竖条（真机 w36，竖排 tab + 计数） */}
      <div className="roster-tabbar" data-testid="roster-iconrail">
        {tabs.map((t) => (
          <button
            key={t.key}
            className="roster-tab"
            data-active={tab === t.key ? 'true' : undefined}
            onClick={() => setTab(t.key)}
            title={t.label}
            aria-label={t.label}
          >
            <span>{t.icon}</span>
            <span className="tabular-nums">{t.count}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
