import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import { useHashState } from '../lib/hashQuery.js';
import { GROUP_MODES, groupFriends } from '../lib/group.js';
import Skeleton from '../components/Skeleton.jsx';

const TRUST_NAME = { 1: '新用户', 2: '基本用户', 3: '已知用户', 4: '可信用户' };
const STATUS_COLOR = {
  active: 'var(--status-active)',
  'join me': 'var(--status-joinme)',
  'ask me': 'var(--status-askme)',
  busy: 'var(--status-busy)',
  offline: 'var(--status-offline)'
};

const PLAT = { standalonewindows: 'PC', android: 'Quest', ios: 'iOS', web: 'Web' };

/** 一起玩过的时长：分钟 → 真机那种「12 小时 8 分」 */
function dur(min) {
  const n = Math.max(0, Number(min ?? 0));
  if (!n) return '—';
  if (n < 60) return `${n} 分`;
  if (n < 1440) return `${Math.floor(n / 60)} 小时${n % 60 ? ` ${n % 60} 分` : ''}`;
  return `${Math.floor(n / 1440)} 天 ${Math.floor((n % 1440) / 60)} 小时`;
}

function Platform({ p }) {
  if (!p) return null;
  const key = p === 'standalonewindows' ? 'pc' : p === 'android' ? 'quest' : p === 'ios' ? 'ios' : 'web';
  return <span className="plat" data-p={key}>{PLAT[p] ?? p}</span>;
}

/**
 * 好友列表：按 docs/ref/vrcx0-friendlist.png 的真机表格重做。
 *   工具栏：筛选 / 搜索好友 / 加载共同好友 / 拉取缺失的字段
 *   列（9 条，顺序照截图）：序号 · 模型 · 昵称 · 信誉等级 · 状态 · 语言 · 社交链接 · 一起玩的次数 · 一起玩过的时长
 *   每页 20 行，底部页码（真机 165 条 9 页）
 */
const COLS = [
  { key: 'idx', label: '序号', w: 44 },
  { key: 'avatar', label: '模型', w: 64 },
  { key: 'name', label: '昵称', w: 0 },
  { key: 'trust', label: '信誉等级', w: 96 },
  { key: 'state', label: '状态', w: 88 },
  { key: 'lang', label: '语言', w: 88 },
  { key: 'links', label: '社交链接', w: 96 },
  { key: 'meets', label: '一起玩的次数', w: 104 },
  { key: 'mins', label: '一起玩过的时长', w: 120 },
];
const PAGE_SIZE = 20;

export default function FriendListPage() {
  // 86 筛选状态进地址栏（#/friendlist?trust=4&fav=1），刷新与深链都能还原
  const [f, setF] = useHashState({
    q: '', trust: '', tag: '', fav: false, sort: 'last_seen', group: 'none', page: 1, panel: false
  });
  const { q, trust, tag, fav, sort, group } = f;
  const page = Math.max(1, Number(f.page) || 1);
  const panel = String(f.panel) === 'true' || f.panel === true;
  const setQ = (v) => setF({ q: v, page: 1 });
  const setTrust = (v) => setF({ trust: v, page: 1 });
  const setTag = (v) => setF({ tag: v, page: 1 });
  const setFav = (v) => setF({ fav: v, page: 1 });
  const setSort = (v) => setF({ sort: v, page: 1 });
  const setGroup = (v) => setF({ group: v, page: 1 });
  const setPage = (v) => setF({ page: v });
  const active = [q, trust, tag, fav ? '1' : '', sort !== 'last_seen' ? '1' : '', group !== 'none' ? '1' : ''].filter(Boolean).length;
  const { openFriend } = useDrawer();

  const params = new URLSearchParams({ limit: '2000', sort, page_size: String(PAGE_SIZE), page: String(page) });
  if (q) params.set('q', q);
  if (trust) params.set('trust', trust);
  if (tag) params.set('tag', tag);
  if (fav) params.set('favorite', '1');
  const { data, isLoading } = useQuery({
    queryKey: ['friend-list', q, trust, tag, fav, sort, page],
    queryFn: () => api(`friend-list?${params.toString()}`)
  });

  const rows = data?.friends ?? [];
  const tagOptions = data?.tags ?? [];
  const pages = data?.pages ?? 1;
  const base = (page - 1) * PAGE_SIZE;

  return (
    <div className="p-4">
      {/* 真机工具栏：筛选 / 搜索好友 / 加载共同好友 / 拉取缺失的字段 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          className="chip"
          data-filter-toggle="1"
          aria-pressed={panel}
          onClick={() => setF({ panel: !panel })}
          style={panel || active ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
        >
          筛选{active ? ` ${active}` : ''}
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索好友"
          aria-label="搜索好友"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-56 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <button className="chip" disabled title="VRCX-0 的「加载共同好友」需要 VRChat 好友关系接口，本站未接入">加载共同好友</button>
        <button className="chip" disabled title="本站采集器只存已有字段，没有缺失字段可拉取">拉取缺失的字段</button>
        <span className="ml-auto text-[12px] text-fg3" data-count="1">
          {data?.matched ?? 0} / {data?.total ?? 0} 人 · 在线 {data?.online ?? 0}
        </span>
      </div>

      {panel ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-filter-panel="1">
          <select className="h-8 rounded-lg border px-2 text-[12px]" value={trust} onChange={(e) => setTrust(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
            <option value="">全部信誉等级</option>
            {[4, 3, 2, 1].map((r) => <option key={r} value={String(r)}>{TRUST_NAME[r]}</option>)}
          </select>
          <select className="h-8 max-w-[160px] rounded-lg border px-2 text-[12px]" value={tag} onChange={(e) => setTag(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
            <option value="">全部标签</option>
            {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => setFav(!fav)} className="chip" style={fav ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}>
            {fav ? '★ 只看收藏' : '☆ 只看收藏'}
          </button>
          <select className="h-8 rounded-lg border px-2 text-[12px]" value={sort} onChange={(e) => setSort(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
            <option value="last_seen">按最后在线</option>
            <option value="name">按名字</option>
            <option value="trust">按信誉等级</option>
          </select>
          {/* 107 分组：世界 / 收藏 / 信任等级，组头带计数 */}
          <select className="h-8 rounded-lg border px-2 text-[12px]" value={group} onChange={(e) => setGroup(e.target.value)} data-group={group} aria-label="分组方式" style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
            {Object.entries(GROUP_MODES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {active ? (
            <button className="chip" data-reset="1" onClick={() => setF({ q: '', trust: '', tag: '', fav: false, sort: 'last_seen', group: 'none', page: 1 })}>清空筛选</button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? <Skeleton rows={8} cols={9} /> : null}

      {!isLoading && rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">没有匹配的好友</div>
          <div className="mt-1 text-[12px] text-fg3">换个筛选条件试试。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl fl-tbl">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className="fl-th" style={c.w ? { width: c.w } : undefined}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupFriends(rows, group).map((g) => [
                g.label ? (
                  <tr key={`grp-${g.key}`} className="group-row" data-group-key={g.key} data-group-count={g.count}>
                    <td colSpan={COLS.length}>
                      <span className="font-medium">{g.label}</span>
                      <span className="ml-2 tabular-nums text-fg3">{g.count} 人</span>
                    </td>
                  </tr>
                ) : null,
                ...g.rows.map((f2, i) => (
                  <tr key={f2.user_id} data-uid={f2.user_id} onClick={() => openFriend(f2.user_id)} className="cursor-pointer">
                    <td className="tabular-nums text-[12px] text-fg3" data-label="序号">{base + i + 1}</td>
                    <td data-label="模型">
                      <span className="fl-av">
                        {f2.avatar_thumb
                          ? <img src={imgUrl(f2.avatar_thumb)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                          : null}
                      </span>
                    </td>
                    <td className="min-w-0" data-label="昵称">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="avatar">
                          {f2.icon_url ? <img src={imgUrl(f2.icon_url)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                          <span className="dot" style={{ background: STATUS_COLOR[f2.status] ?? 'var(--status-offline)' }} />
                        </span>
                        <span className="min-w-0 truncate">{f2.display_name}</span>
                        {f2.favorite ? <span className="shrink-0 text-[11px]" style={{ color: 'var(--status-joinme)' }}>★</span> : null}
                        {f2.platform ? <Platform p={f2.platform} /> : null}
                      </span>
                    </td>
                    <td className="text-[12px] text-fg2" data-label="信誉等级">{TRUST_NAME[f2.trust_rank] ?? '—'}</td>
                    <td className="text-[12px]" data-label="状态">
                      <span className="flex items-center gap-1.5">
                        <span className="dot" style={{ background: STATUS_COLOR[f2.status] ?? 'var(--status-offline)' }} />
                        {f2.state_label ?? (f2.online ? '在线' : '离线')}
                      </span>
                    </td>
                    <td className="text-[12px] text-fg2" data-label="语言">{f2.language ?? '—'}</td>
                    <td className="text-[12px] text-fg3" data-label="社交链接" title={f2.social_links ? undefined : '未采集 bio 链接'}>
                      {f2.social_links ?? '—'}
                    </td>
                    <td className="tabular-nums text-[12px] text-fg2" data-label="一起玩的次数">{f2.together_count ?? 0}</td>
                    <td className="tabular-nums text-[12px] text-fg3" data-label="一起玩过的时长">{dur(f2.together_minutes)}</td>
                  </tr>
                ))
              ])}
            </tbody>
          </table>
        </div>
      )}

      {/* 底部页码：真机 165 条 / 每页 20 = 9 页 */}
      {!isLoading && rows.length ? (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-fg3" data-pager="1" data-pages={pages} data-page-size={PAGE_SIZE}>
          <button className="chip" data-page-prev="1" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span className="tabular-nums" data-page-now={page}>第 {page} / {pages} 页</span>
          <button className="chip" data-page-next="1" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
          <span className="ml-auto">每页 {PAGE_SIZE} 条</span>
        </div>
      ) : null}
    </div>
  );
}
