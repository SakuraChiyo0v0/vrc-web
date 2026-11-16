import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, BASE, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';

const STATUS_COLOR = {
  active: 'var(--status-active)',
  'join me': 'var(--status-joinme)',
  'ask me': 'var(--status-askme)',
  busy: 'var(--status-busy)',
  offline: 'var(--status-offline)'
};

/** 78 顶部标签：顺序与 VRCX-0 真机一致，计数来自 /api/roster facets */
const TABS = [
  ['online', '在线'],
  ['favorite', '好友收藏'],
  ['same_room', '同一房间'],
  ['active', '活跃中'],
  ['offline', '离线']
];

function locLabel(f) {
  if (!f.location) return '未知';
  if (f.location === 'offline') return '离线';
  if (f.location === 'private') return '私密世界';
  if (f.location === 'traveling') return '切换中';
  // 世界元数据拉不到（私有/已删除/接口失败）时显示人话，不要把 wrld_xxx 甩给用户
  if (f.world_name) return f.world_name;
  if (String(f.location).startsWith('wrld_')) return '未知世界';
  return f.location;
}

/** 79 在线时长：真机为「36分钟」这种短写法，超过 24h 才带天 */
function dur(m) {
  const n = Number(m ?? 0);
  if (!n) return '';
  if (n < 60) return `${n}分钟`;
  if (n < 1440) return `${Math.floor(n / 60)}小时${n % 60 ? `${n % 60}分` : ''}`;
  return `${Math.floor(n / 1440)}天${Math.floor((n % 1440) / 60)}小时`;
}

function Avatar({ f }) {
  const color = STATUS_COLOR[f.status] ?? 'var(--status-offline)';
  return (
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
  );
}

/** 64 平台徽章：PC/Quest/iOS 各自品牌色，未知平台回落灰字 */
function Platform({ p }) {
  if (!p) return null;
  const key = p === 'standalonewindows' ? 'pc' : p === 'android' ? 'quest' : p === 'ios' ? 'ios' : 'web';
  const label = key === 'pc' ? 'PC' : key === 'quest' ? 'Quest' : key === 'ios' ? 'iOS' : p;
  return <span className="plat" data-p={key}>{label}</span>;
}

function fmtMinutes(m) {
  const n = Number(m ?? 0);
  if (n < 60) return `${n} 分钟`;
  return `${Math.floor(n / 60)} 小时 ${n % 60} 分`;
}

/** 44 今日摘要：在线时长 / 遇到的人 / 新世界 */
function TodaySummary() {
  const { data } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api('summary/today'),
    refetchInterval: 30_000
  });
  const cards = [
    ['今日在线', fmtMinutes(data?.onlineMinutes), '自己待在房间里的累计时长'],
    ['遇到的人', data?.players ?? 0, '今天同房过的人'],
    ['新世界', data?.newWorlds ?? 0, '第一次去的世界']
  ];
  return (
    <div className="mb-3 summary-grid">
      {cards.map(([label, value, hint]) => (
        <div key={label} className="card px-3 py-2" title={hint}>
          <div className="label-xs">{label}</div>
          <div className="mt-0.5 text-[14px] tabular-nums">{value}</div>
          <div className="truncate text-[11px] text-fg3">{hint}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * 78/79 好友位置：顶部五个可点标签（计数来自 /api/roster），
 * 每条 = 头像+在线点+名字+状态+区域+在线时长+世界·访问级别。
 * 数据走 roster（与右栏同一份来源），不再另外算一遍。
 */
export default function FriendsPage() {
  const [tab, setTab] = useState('online');
  const [q, setQ] = useState('');
  const { openFriend } = useDrawer();
  const { data, isLoading } = useQuery({
    queryKey: ['roster'],
    queryFn: () => api('roster'),
    refetchInterval: 30_000
  });

  const facets = data?.facets ?? {};
  const groups = useMemo(() => {
    const list = (data?.friends ?? []).filter((f) => {
      if (q && !(f.display_name ?? '').toLowerCase().includes(q.toLowerCase())) return false;
      if (tab === 'offline') return !f.online;
      if (tab === 'online') return f.online;
      if (tab === 'favorite') return f.favorite;
      if (tab === 'same_room') return f.same_room;
      if (tab === 'active') return f.active;
      return true;
    });
    const map = new Map();
    for (const f of list) {
      const k = locLabel(f);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data, q, tab]);

  return (
    <div className="p-4">
      <TodaySummary />

      {/* 78 一排可点标签，当前项加深（chip[data-active]） */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className="chip"
            data-active={tab === key}
            data-facet={key}
            onClick={() => setTab(key)}
          >
            {label} <span className="tabular-nums opacity-70">{facets[key] ?? 0}</span>
          </button>
        ))}
        <a className="chip ml-auto" href={`${BASE}api/export/friends.csv`} download>导出 CSV</a>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索好友"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-60 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <span className="text-[12px] text-fg3">{data?.returned ?? 0} / {data?.total ?? 0} 人</span>
      </div>

      {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}

      {/* 61 单列 32px 行列表（VRCX-0 compact 档），不再三列卡片网格 */}
      <div className="flex flex-col gap-2">
        {groups.map(([world, people]) => (
          <section key={world} className="card overflow-hidden">
            <div className="group-head" style={{ background: 'var(--surface-raised)' }}>
              <span className="truncate font-medium">{world}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-fg3">{people.length} 人</span>
            </div>
            <div className="flex flex-col p-1">
              {people.map((f) => (
                <div key={f.user_id} className="friend-row" onClick={() => openFriend(f.user_id)}>
                  <UserHoverCard id={f.user_id}>
                    <Avatar f={f} />
                  </UserHoverCard>
                  <span className="min-w-0 flex-1 truncate">{f.display_name ?? f.user_id}</span>
                  <span className="hidden min-w-0 max-w-[26%] truncate text-fg2 lg:block">
                    {f.status ?? '—'}
                    {f.status_description ? `「${f.status_description}」` : ''}
                  </span>
                  {/* 79 「世界名·公开」+ 区域 + 在线时长 */}
                  <span className="hidden min-w-0 max-w-[26%] truncate text-fg3 sm:block">
                    {f.online ? `${f.world_name ?? '未知世界'}·${f.access_label ?? '公开'}` : '—'}
                  </span>
                  {f.region ? <span className="reg">{String(f.region).toUpperCase()}</span> : null}
                  <Platform p={f.platform} />
                  <span className="w-14 shrink-0 text-right tabular-nums text-fg3">
                    {f.online ? dur(f.online_minutes) : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!isLoading && groups.length === 0 ? (
          <div className="card p-8 text-center text-[12px] text-fg3">这个筛选下没有人</div>
        ) : null}
      </div>
    </div>
  );
}
