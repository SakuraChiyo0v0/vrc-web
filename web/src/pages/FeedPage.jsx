import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { ErrorCard } from '../components/ErrorBoundary.jsx';
import { useDrawer } from '../components/drawers.jsx';
import RowMenu, { Hint, friendItems, useHint, useRowMenu } from '../components/RowMenu.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';
import { useListNav } from '../lib/listnav.js';
/**
 * 80 动态页改表格（规格取自 VRCX-0 真机截图 docs/ref/feed-measure.json）：
 *   列 = 时间 / 玩家 / 类型 / 详细信息；表头 44 / 行高 44；表格左边距 19、宽 988（不铺满面板）
 *   工具条单行：视图切换 + 类型下拉 → 右侧搜索框（内含日期）
 *   类型文案照真机：位置变动 / 上线 / 模型变动；无页脚（连续滚动）
 */
const KIND = {
  online: ['上线', '▲'],
  active: ['活跃', '◆'],
  offline: ['下线', '▼'],
  location: ['位置变动', '⌖'],
  profile: ['模型变动', '◉'],
  status: ['状态变动', '◌'],
  friend_add: ['加好友', '+'],
  friend_delete: ['删好友', '−'],
  self_profile: ['自己变更', '✎']
};

const KINDS = [['', '类型'], ['online', '上线'], ['location', '位置变动'], ['offline', '下线'], ['active', '活跃'], ['status', '状态变动'], ['profile', '模型变动']];
const LIMIT = 80;

const ACCESS_LABEL = { public: '公开', 'friends+': '好友+', friends: '仅好友', group: '群组公开' };

/**
 * 真机时间列只给「时:分」（不带前导 0）——真机列表是当天的，日期在工具条里选。
 * 跨日行补「月-日」，另起一行（\n + CSS white-space:pre-line）：
 * 列宽只有 106（文字起点 78），单行「11-23 21:06」会折成 3 行把 44px 行高撑到 55。
 */
function clock(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = `${d.getHours()}`;
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\n${hh}:${mm}`;
}

/** location 串 → 区域 / 访问级别（wrld_x:inst~hidden(usr)~region(jp)） */
function locMeta(loc) {
  const s = String(loc ?? '');
  if (!s || s === 'offline' || s === 'private' || s === 'traveling') return { region: null, access: null };
  const region = (s.match(/~region\(([^)]+)\)/) || [])[1] ?? null;
  let access = 'public';
  if (/~hidden\(/.test(s)) access = 'friends';
  else if (/~friends\(/.test(s)) access = 'friends+';
  else if (/~group\(/.test(s)) access = 'group';
  return { region, access: ACCESS_LABEL[access] };
}

function sinceFor(range) {
  const now = Date.now();
  if (range === '1h') return new Date(now - 3600_000).toISOString();
  if (range === '24h') return new Date(now - 86400_000).toISOString();
  if (range === '7d') return new Date(now - 7 * 86400_000).toISOString();
  return '';
}

const stamp = (iso) =>
  new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

/** 详细信息列：`JP Alpha Club · 仅好友`，私密/离线退化成短语 */
function Detail({ e }) {
  const { openWorld } = useDrawer();
  if (!e.location || e.location === 'offline') return <span className="text-fg3">—</span>;
  if (e.location === 'private') return <span className="text-fg3">私密世界</span>;
  if (e.location === 'traveling') return <span className="text-fg3">切换中</span>;
  const { region, access } = locMeta(e.location);
  const name = e.world_name ?? (String(e.location).startsWith('wrld_') ? '未知世界' : e.location);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {region ? <span className="reg">{region.toUpperCase()}</span> : null}
      {e.world_id ? (
        <button className="min-w-0 truncate text-left hover:underline" onClick={() => openWorld(e.world_id)}>
          {name}
        </button>
      ) : (
        <span className="min-w-0 truncate">{name}</span>
      )}
      {access ? <span className="shrink-0 text-[11px] text-fg3">· {access}</span> : null}
    </span>
  );
}

export default function FeedPage() {
  const [kind, setKind] = useState('');
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [day, setDay] = useState('');
  const { openFriend, close } = useDrawer();
  const { hint, say } = useHint();
  const menu = useRowMenu();

  // 118 真机没有时间范围 chip 行：一次拉最近 80 条，筛选全在工具条（类型/搜索/日期）
  const { data, isLoading, isFetching, isError, error, refetch, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['events', kind],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api(`events?kind=${encodeURIComponent(kind)}&limit=${LIMIT}&offset=${pageParam}`),
    getNextPageParam: (last, pages) => (last?.has_more ? pages.length * LIMIT : undefined)
  });

  // 真机是连续列表（无「今天/昨天」分组行），筛选也只在前端做
  const all = (data?.pages ?? []).flatMap((p) => p.events ?? []);
  const events = all.filter((e) => {
    if (q) {
      const hay = `${e.display_name ?? ''} ${e.world_name ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (day) {
      const d = new Date(e.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key !== day) return false;
    }
    return true;
  });
  const nav = useListNav({
    count: events.length,
    onEnter: (i) => {
      const e = events[i];
      if (e?.user_id) openFriend(e.user_id);
    },
    onEscape: close,
  });
  const rowMenu = (ev, e) =>
    menu.open(ev, friendItems({ id: e.user_id, name: e.display_name ?? e.user_id, openFriend, say }));

  // 真机无页脚（feed-measure.footer=false）：滚到底自动续页，不摆「加载更多」按钮/条数文案
  const sentinel = useRef(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return undefined;
    const io = new IntersectionObserver(
      (es) => { if (es.some((x) => x.isIntersecting) && !isFetching) fetchNextPage(); },
      { root: el.closest('.feed-scroll') || null, rootMargin: '200px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  // 工具条按真机单行排列：视图切换 →「类型」下拉 → 右侧搜索框（右侧内嵌日期选择）
  const toolbar = (
    <div className="feed-toolbar" data-testid="feed-toolbar">
      <div className="feed-views" role="group" aria-label="视图">
        <button data-testid="feed-view-table" data-active={view === 'table'} title="表格视图" onClick={() => setView('table')}>▤</button>
        <button data-testid="feed-view-cards" data-active={view === 'cards'} title="卡片视图" onClick={() => setView('cards')}>▦</button>
      </div>
      <label className="feed-select">
        <select data-testid="feed-kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="类型">
          {KINDS.map(([v, label]) => <option key={v || 'all'} value={v}>{label}</option>)}
        </select>
      </label>
      <div className="feed-search">
        <span aria-hidden="true">⌕</span>
        <input data-testid="feed-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" />
        <input data-testid="feed-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="日期" title="按日期筛选" />
      </div>
    </div>
  );

  const kindCell = (e) => {
    const [label, glyph] = KIND[e.kind] ?? [e.kind, '·'];
    return (
      <span className="ek" data-kind={e.kind}>
        <span className="ek-glyph">{glyph}</span>
        {label}
      </span>
    );
  };

  if (isLoading)
    return (
      <div className="feed-page">
        {toolbar}
        <Skeleton rows={8} cols={4} />
      </div>
    );

  if (!events.length && isError) {
    return (
      <div className="feed-page">
        {toolbar}
        <ErrorCard title="动态读不出来" error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="feed-page">
        {toolbar}
        <Empty icon="inbox" title={kind || q || day ? '这个筛选下没有事件' : '还没有事件'} hint={kind || q || day ? '换个类型、关键词或日期试试。' : '采集器连上 pipeline 后，好友上下线和换房会实时出现在这里。'} />
      </div>
    );
  }

  return (
    <div className="feed-page">
      {toolbar}
      {view === 'cards' ? (
        <div className="feed-cards" data-testid="feed-cards">
          {events.map((e, i) => (
            <div key={e.id} className="feed-card-row" data-nav-idx={i} data-nav-active={nav.active === i} onContextMenu={(ev) => rowMenu(ev, e)}>
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-nums text-[11px] text-fg3">{clock(e.at)}</span>
                {kindCell(e)}
              </div>
              <button
                className="mt-1 max-w-full truncate text-left text-[12px] hover:underline"
                onClick={() => (e.user_id ? openFriend(e.user_id) : null)}
              >
                {e.display_name ?? e.user_id ?? '—'}
              </button>
              <div className="mt-0.5 min-w-0 text-[12px] text-fg3"><Detail e={e} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="feed-scroll" data-testid="feed-scroll">
        <table className="tbl feed-tbl" data-testid="feed-table">
          <colgroup>
            <col style={{ width: 104 }} />
            <col style={{ width: 199 }} />
            <col style={{ width: 169 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>时间</th>
              <th>玩家</th>
              <th>类型</th>
              <th>详细信息</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={e.id}
                className="feed-row"
                data-nav-idx={i}
                data-nav-active={nav.active === i}
                onContextMenu={(ev) => rowMenu(ev, e)}
              >
                <td className="tabular-nums text-[12px] text-fg3" data-label="时间">{clock(e.at)}</td>
                <td className="truncate text-[12px]" data-label="玩家">
                  <UserHoverCard id={e.user_id}>
                    <button
                      className="max-w-full truncate text-left hover:underline"
                      onClick={() => (e.user_id ? openFriend(e.user_id) : null)}
                      style={{ cursor: e.user_id ? 'pointer' : 'default' }}
                    >
                      {e.display_name ?? e.user_id ?? '—'}
                    </button>
                  </UserHoverCard>
                </td>
                <td data-label="类型">{kindCell(e)}</td>
                <td className="min-w-0" data-label="详细">
                  <Detail e={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={sentinel} data-testid="feed-sentinel" style={{ height: 1 }} />
        </div>
      )}

      <RowMenu menu={menu.menu} onClose={menu.close} />
      <Hint text={hint} />
    </div>
  );
}
