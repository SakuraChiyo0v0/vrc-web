1|import { useInfiniteQuery } from '@tanstack/react-query';
2|import { useState } from 'react';
3|import { api } from '../api.js';
4|import Empty from '../components/Empty.jsx';
5|import Skeleton from '../components/Skeleton.jsx';
6|import { ErrorCard } from '../components/ErrorBoundary.jsx';
7|import { useDrawer } from '../components/drawers.jsx';
8|import RowMenu, { Hint, friendItems, useHint, useRowMenu } from '../components/RowMenu.jsx';
9|import UserHoverCard from '../components/UserHoverCard.jsx';
10|import { useListNav } from '../lib/listnav.js';
11|12|
13|/**
14| * 80 动态页改表格（规格取自 VRCX-0 真机截图）：
15| *   列 = 时间 / 玩家 / 类型 / 详细信息；行高 40–48px；无头像
16| *   类型图标色走 CSS 语义变量（87：上线绿 / 下线灰 / 换房青 / 改资料紫），行内不再写死颜色
17| *   详细信息 = 区域 + 世界名 + 访问级别（好友+ / 群组公开 / 仅好友）
18| */
19|const KIND = {
20|  online: ['上线', '▲'],
21|  active: ['活跃', '◆'],
22|  offline: ['下线', '▼'],
23|  location: ['换房', '→'],
24|  profile: ['资料变更', '✎'],
25|  friend_add: ['加好友', '+'],
26|  friend_delete: ['删好友', '−'],
27|  self_profile: ['自己变更', '✎']
28|};
29|
30|const KINDS = [['', '全部'], ['online', '上线'], ['location', '换房'], ['offline', '下线'], ['active', '活跃'], ['profile', '资料变更']];
31|const LIMIT = 80;
32|
33|const ACCESS_LABEL = { public: '公开', 'friends+': '好友+', friends: '仅好友', group: '群组公开' };
34|
35|/** 真机时间列只给「时:分」（不带前导 0），不是今天时补「月-日」 */
36|function clock(iso) {
37|  const d = new Date(iso);
38|  const now = new Date();
39|  const sameDay = d.toDateString() === now.toDateString();
40|  const hh = `${d.getHours()}`;
41|  const mm = String(d.getMinutes()).padStart(2, '0');
42|  if (sameDay) return `${hh}:${mm}`;
43|  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
44|}
45|
46|/** location 串 → 区域 / 访问级别（wrld_x:inst~hidden(usr)~region(jp)） */
47|function locMeta(loc) {
48|  const s = String(loc ?? '');
49|  if (!s || s === 'offline' || s === 'private' || s === 'traveling') return { region: null, access: null };
50|  const region = (s.match(/~region\(([^)]+)\)/) || [])[1] ?? null;
51|  let access = 'public';
52|  if (/~hidden\(/.test(s)) access = 'friends';
53|  else if (/~friends\(/.test(s)) access = 'friends+';
54|  else if (/~group\(/.test(s)) access = 'group';
55|  return { region, access: ACCESS_LABEL[access] };
56|}
57|
58|function sinceFor(range) {
59|  const now = Date.now();
60|  if (range === '1h') return new Date(now - 3600_000).toISOString();
61|  if (range === '24h') return new Date(now - 86400_000).toISOString();
62|  if (range === '7d') return new Date(now - 7 * 86400_000).toISOString();
63|  return '';
64|}
65|
66|const stamp = (iso) =>
67|  new Date(iso).toLocaleString('zh-CN', {
68|    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
69|  });
70|
71|/** 详细信息列：`JP Alpha Club · 仅好友`，私密/离线退化成短语 */
72|function Detail({ e }) {
73|  const { openWorld } = useDrawer();
74|  if (!e.location || e.location === 'offline') return <span className="text-fg3">—</span>;
75|  if (e.location === 'private') return <span className="text-fg3">私密世界</span>;
76|  if (e.location === 'traveling') return <span className="text-fg3">切换中</span>;
77|  const { region, access } = locMeta(e.location);
78|  const name = e.world_name ?? (String(e.location).startsWith('wrld_') ? '未知世界' : e.location);
79|  return (
80|    <span className="flex min-w-0 items-center gap-1.5">
81|      {region ? <span className="reg">{region.toUpperCase()}</span> : null}
82|      {e.world_id ? (
83|        <button className="min-w-0 truncate text-left hover:underline" onClick={() => openWorld(e.world_id)}>
84|          {name}
85|        </button>
86|      ) : (
87|        <span className="min-w-0 truncate">{name}</span>
88|      )}
89|      {access ? <span className="shrink-0 text-[11px] text-fg3">· {access}</span> : null}
90|    </span>
91|  );
92|}
93|
94|export default function FeedPage() {
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

  // 工具条按真机排列：表格/卡片 两个视图按钮 →「类型」下拉 → 搜索 → 日历
  const toolbar = (
    <div className="feed-toolbar" data-testid="feed-toolbar">
      <div className="feed-views" role="group" aria-label="视图">
        <button data-testid="feed-view-table" data-active={view === 'table'} title="表格视图" onClick={() => setView('table')}>▤</button>
        <button data-testid="feed-view-cards" data-active={view === 'cards'} title="卡片视图" onClick={() => setView('cards')}>▦</button>
      </div>
      <label className="feed-select">
        <select data-testid="feed-kind" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="类型">
          {KINDS.map(([v, label]) => <option key={v || 'all'} value={v}>{v ? label : '类型'}</option>)}
        </select>
      </label>
      <div className="feed-search">
        <span aria-hidden="true">⌕</span>
        <input data-testid="feed-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" />
      </div>
      <label className="feed-date" title="按日期筛选">
        <input data-testid="feed-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="日期" />
      </label>
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
        <table className="tbl feed-tbl" data-testid="feed-table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>时间</th>
              <th style={{ width: 150 }}>玩家</th>
              <th style={{ width: 104 }}>类型</th>
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
      )}

      <div className="mt-2 flex items-center justify-center gap-2">
        {hasNextPage ? (
          <button className="chip" onClick={() => fetchNextPage()} disabled={isFetching}>
            {isFetching ? '加载中…' : '加载更多'}
          </button>
        ) : (
          <span className="text-[11px] text-fg3">共 {events.length} 条，到底了</span>
        )}
      </div>
      <RowMenu menu={menu.menu} onClose={menu.close} />
      <Hint text={hint} />
    </div>
  );
}
