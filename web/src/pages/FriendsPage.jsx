import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { SortCol } from '../components/SortHead.jsx';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv.js';
import { groupFriendsByLocation } from '../lib/locationGroups.js';
import { matchText } from '../lib/pinyin.js';
import { usePref, useSort } from '../lib/prefs.js';
import { SORT_COLUMNS, sortRows } from '../lib/sort.js';

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

/**
 * 真机卡片（docs/ref/vrcx0-locations.png + spec.friends_locations）：
 * 头像 56（正圆）· 卡片高 96 · 白底 1px 浅灰边框 · 名字 / 在线时长 / 区域+世界·访问 / 状态消息 四行。
 * 世界栏里的卡片不重复世界名（栏头已写）；私人房间卡不显示在线时长（真机只留名字+状态）。
 */
function LocCard({ f, showWorld, showDur, openFriend }) {
  const world = f.world_name ?? '未知世界';
  const status = f.status_description || f.status || '';
  return (
    <div
      className="friend-row loc-card"
      data-user={f.user_id}
      data-online={f.online ? '1' : '0'}
      onClick={() => openFriend(f.user_id)}
    >
      <div className="loc-body">
        {/* 真机布局（docs/ref/vrcx0-locations.png 283,320 起像素图）：头像行右侧只放名字+时长，
            世界行与状态行从卡片左内边距起跨整卡宽，排在头像下方。 */}
        <div className="loc-top">
          <UserHoverCard id={f.user_id}>
            <Avatar f={f} />
          </UserHoverCard>
          <div className="loc-meta">
            <div className="loc-name">
              <span className="truncate">{f.display_name ?? f.user_id}</span>
              {f.favorite ? <span className="loc-star">★</span> : null}
            </div>
            {showDur ? (
              <div className="loc-dur tabular-nums">{f.online ? dur(f.online_minutes) : '离线'}</div>
            ) : null}
          </div>
        </div>
        {showWorld && f.online ? (
          <div className="loc-world">
            {f.region ? <span className="loc-code">{String(f.region).toUpperCase()}</span> : null}
            <span className="truncate">{world}{f.access_label ? ` · ${f.access_label}` : ''}</span>
          </div>
        ) : null}
        <div className="loc-status" title={status}>{status || (f.online ? '…' : '')}</div>
      </div>
    </div>
  );
}

/**
 * 78/79 好友位置：按真机 locations 页复刻 ——
 *   工具栏（网格/列表切换 + 在线/收藏/同房/活跃/离线标签 + 搜索）
 *   → 分栏：同实例 ≥2 人成世界栏；单人 → 好友收藏 / 其他在线好友 / 位于私人房间；离线垫底
 *   → 网格视图 6 列卡片（手机 2 列），列表视图保留紧凑行
 */
export default function FriendsPage() {
  // 102 标签 / 搜索词 / 排序 / 视图都记在 localStorage，刷新后保持
  const [tab, setTab] = usePref('friends:tab', 'online');
  const [q, setQ] = usePref('friends:q', '');
  const [view, setView] = usePref('friends:view', 'grid');
  const [sort, onSort] = useSort('friends', 'name');
  const [closed, setClosed] = useState(() => localStorage.getItem('friends:private-closed') === '1');
  const { openFriend } = useDrawer();
  const { data, isLoading } = useQuery({
    queryKey: ['roster'],
    queryFn: () => api('roster'),
    refetchInterval: 30_000
  });

  const facets = data?.facets ?? {};
  const list = useMemo(() => {
    const rows = (data?.friends ?? []).filter((f) => {
      if (!matchText(f.display_name, q)) return false;
      if (tab === 'offline') return !f.online;
      if (tab === 'online') return f.online;
      if (tab === 'favorite') return f.favorite;
      if (tab === 'same_room') return f.same_room;
      if (tab === 'active') return f.active;
      return true;
    });
    return sortRows(rows, SORT_COLUMNS.friends, sort.key, sort.dir);
  }, [data, q, tab, sort]);

  const groups = useMemo(() => groupFriendsByLocation(list), [list]);
  const shown = list;

  // 103 导出行 = 页面上这几行，不另外请求接口
  const exportNow = () => {
    const { text, rows } = toCsv([
      { key: 'display_name', label: '名字' },
      { key: 'status', label: '状态' },
      { key: 'world_name', label: '所在世界' },
      { key: 'online_minutes', label: '在线时长(分)' },
      { key: 'user_id', label: 'user_id' }
    ], shown);
    downloadCsv(csvFilename(`friends-${tab}`), text);
    return rows;
  };

  const togglePrivate = () => {
    const v = !closed;
    setClosed(v);
    localStorage.setItem('friends:private-closed', v ? '1' : '0');
  };

  return (
    <div className="p-4">
      {/* 真机工具栏：左侧网格/列表切换 + 一排可点标签，右侧搜索 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          className="chip"
          data-view="grid"
          aria-pressed={view === 'grid'}
          title="网格视图（按所在世界分栏）"
          onClick={() => setView('grid')}
        >
          ▦
        </button>
        <button
          className="chip"
          data-view="list"
          aria-pressed={view === 'list'}
          title="列表视图（紧凑行）"
          onClick={() => setView('list')}
        >
          ☷
        </button>
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索好友"
          aria-label="搜索好友"
          className="ml-auto h-8 min-w-0 rounded-lg border px-2.5 text-[12px] outline-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)', width: 220 }}
        />
        {/* 103 导出跟随当前 tab + 搜索 + 排序 */}
        <button
          className="chip"
          data-export="friends"
          data-export-rows={shown.length}
          disabled={shown.length === 0}
          onClick={exportNow}
          style={shown.length === 0 ? { opacity: 0.5, cursor: 'default' } : undefined}
        >
          导出 CSV
        </button>
        <span className="text-[12px] text-fg3" data-count="filtered">
          {shown.length} / {data?.total ?? 0} 人
        </span>
      </div>

      {isLoading ? <Skeleton rows={6} cols={3} /> : null}

      {view === 'grid' ? (
        <div className="loc-groups" data-view="grid">
          {groups.map((g) => {
            const isPrivate = g.type === 'private';
            const collapsed = isPrivate && closed;
            return (
              <section key={g.key} className="loc-group" data-group={g.type} data-group-key={g.key}>
                {/* 组头：区域码 + 世界名 + 访问级别 + 人数徽标（真机灰色圆徽）；私人房间可折叠 */}
                <header
                  className="loc-head"
                  onClick={isPrivate ? togglePrivate : undefined}
                  data-collapsible={isPrivate ? '1' : undefined}
                >
                  {g.type === 'world' ? (
                    <svg className="loc-glyph" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M6 1.5 10.5 4 6 6.5 1.5 4 6 1.5Z" />
                      <path d="M1.5 6 6 8.5 10.5 6" />
                      <path d="M1.5 8.2 6 10.7 10.5 8.2" />
                    </svg>
                  ) : null}
                  {g.region ? <span className="loc-code">{g.region}</span> : null}
                  <span className="loc-title truncate">{g.label}</span>
                  <span className="loc-count tabular-nums">{g.rows.length}</span>
                  {isPrivate ? <span className="loc-caret" data-open={collapsed ? 'false' : 'true'}>›</span> : null}
                </header>
                {collapsed ? null : (
                  <div className="loc-grid" data-grid="friends-locations">
                    {g.rows.map((f) => (
                      <LocCard
                        key={f.user_id}
                        f={f}
                        showWorld={g.type === 'favorite' || g.type === 'others'}
                        showDur={g.type !== 'private'}
                        openFriend={openFriend}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {!isLoading && groups.length === 0 ? (
            <div className="card p-8 text-center text-[12px] text-fg3">这个筛选下没有人</div>
          ) : null}
        </div>
      ) : (
        <>
          {/* 101 列头即排序：名字 / 状态 / 世界 / 在线时长（手机端隐藏，排序仍生效） */}
          <div className="friend-row list-head" data-sort-head="friends">
            <span />
            <SortCol section="friends" col="name" sort={sort} onSort={onSort} />
            <SortCol section="friends" col="status" sort={sort} onSort={onSort} />
            <SortCol section="friends" col="world" sort={sort} onSort={onSort} />
            <span />
            <span />
            <SortCol section="friends" col="duration" sort={sort} onSort={onSort} className="justify-end" />
          </div>

          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <section key={g.key} className="card overflow-hidden">
                <div className="group-head" style={{ background: 'var(--surface-raised)' }}>
                  {g.region ? <span className="loc-code">{g.region}</span> : null}
                  <span className="truncate font-medium">{g.label}</span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-fg3">{g.rows.length} 人</span>
                </div>
                <div className="flex flex-col p-1">
                  {g.rows.map((f) => (
                    <div key={f.user_id} className="friend-row" data-user={f.user_id} onClick={() => openFriend(f.user_id)}>
                      <UserHoverCard id={f.user_id}>
                        <Avatar f={f} />
                      </UserHoverCard>
                      <span className="fr-name">{f.display_name ?? f.user_id}</span>
                      {/* 84 三态语义色：与头像 dot 同一批 CSS 变量，不再一律灰 */}
                      <span className="fr-status st" data-s={f.status ?? 'offline'} title={f.status_description ?? f.status ?? ''}>
                        {f.status ?? '—'}
                        {f.status_description ? `「${f.status_description}」` : ''}
                      </span>
                      {/* 79 「世界名·公开」+ 区域 + 在线时长 */}
                      <span className="fr-world">{f.online ? `${f.world_name ?? '未知世界'}·${f.access_label ?? '公开'}` : '—'}</span>
                      <span className={`fr-reg${f.region ? ' reg' : ''}`}>{f.region ? String(f.region).toUpperCase() : ''}</span>
                      <span className="fr-plat">{f.platform ? <Platform p={f.platform} /> : null}</span>
                      <span className="fr-dur tabular-nums">{f.online ? dur(f.online_minutes) : ''}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!isLoading && groups.length === 0 ? (
              <div className="card p-8 text-center text-[12px] text-fg3">这个筛选下没有人</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
