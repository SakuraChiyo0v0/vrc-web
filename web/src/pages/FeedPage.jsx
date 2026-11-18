import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, BASE } from '../api.js';
import Empty from '../components/Empty.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useDrawer } from '../components/drawers.jsx';
import RowMenu, { Hint, friendItems, useHint, useRowMenu } from '../components/RowMenu.jsx';
import UserHoverCard from '../components/UserHoverCard.jsx';
import { useListNav } from '../lib/listnav.js';

/**
 * 80 动态页改表格（规格取自 VRCX-0 真机截图）：
 *   列 = 时间 / 玩家 / 类型 / 详细信息；行高 40–48px；无头像
 *   类型图标色走 CSS 语义变量（87：上线绿 / 下线灰 / 换房青 / 改资料紫），行内不再写死颜色
 *   详细信息 = 区域 + 世界名 + 访问级别（好友+ / 群组公开 / 仅好友）
 */
const KIND = {
  online: ['上线', '▲'],
  active: ['活跃', '◆'],
  offline: ['下线', '▼'],
  location: ['换房', '→'],
  profile: ['资料变更', '✎'],
  friend_add: ['加好友', '+'],
  friend_delete: ['删好友', '−'],
  self_profile: ['自己变更', '✎']
};

const KINDS = [['', '全部'], ['online', '上线'], ['location', '换房'], ['offline', '下线'], ['active', '活跃'], ['profile', '资料变更']];
const RANGES = [['', '不限时间'], ['1h', '1 小时'], ['24h', '24 小时'], ['7d', '7 天']];
const LIMIT = 80;

const ACCESS_LABEL = { public: '公开', 'friends+': '好友+', friends: '仅好友', group: '群组公开' };

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
  const [range, setRange] = useState('');
  const { openFriend, close } = useDrawer();
  const { hint, say } = useHint();
  const menu = useRowMenu();

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['events', kind, range],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api(`events?kind=${encodeURIComponent(kind)}&since=${encodeURIComponent(sinceFor(range))}&limit=${LIMIT}&offset=${pageParam}`),
    getNextPageParam: (last, pages) => (last?.has_more ? pages.length * LIMIT : undefined)
  });

  const events = (data?.pages ?? []).flatMap((p) => p.events ?? []);
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

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {KINDS.map(([v, label]) => (
        <button key={v || 'all'} onClick={() => setKind(v)} className="chip" data-active={kind === v}>
          {label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px" style={{ background: 'var(--stroke-subtle)' }} />
      {RANGES.map(([v, label]) => (
        <button key={v || 'any'} onClick={() => setRange(v)} className="chip" data-active={range === v}>
          {label}
        </button>
      ))}
      <a className="chip ml-auto" href={`${BASE}api/export/events.csv`} download>
        导出 CSV
      </a>
    </div>
  );

  if (isLoading)
    return (
      <div className="p-4">
        {toolbar}
        <Skeleton rows={8} cols={4} />
      </div>
    );

  if (!events.length) {
    return (
      <div className="p-4">
        {toolbar}
        <Empty icon="inbox" title={kind || range ? '这个筛选下没有事件' : '还没有事件'} hint={kind || range ? '换个事件类型或时间范围试试。' : '采集器连上 pipeline 后，好友上下线和换房会实时出现在这里。'} />
      </div>
    );
  }

  return (
    <div className="p-4">
      {toolbar}
      <div className="card overflow-hidden">
        <table className="tbl feed-tbl">
          <thead>
            <tr>
              <th style={{ width: 148 }}>时间</th>
              <th style={{ width: 132 }}>玩家</th>
              <th style={{ width: 96 }}>类型</th>
              <th>详细信息</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const [label, glyph] = KIND[e.kind] ?? [e.kind, '·'];
              return (
                <tr
                  key={e.id}
                  className="feed-row"
                  data-nav-idx={i}
                  data-nav-active={nav.active === i}
                  onContextMenu={(ev) => rowMenu(ev, e)}
                >
                  <td className="tabular-nums text-[12px] text-fg3">{stamp(e.at)}</td>
                  <td className="truncate text-[12px]">
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
                  <td>
                    <span className="ek" data-kind={e.kind}>
                      <span className="ek-glyph">{glyph}</span>
                      {label}
                    </span>
                  </td>
                  <td className="min-w-0">
                    <Detail e={e} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
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
