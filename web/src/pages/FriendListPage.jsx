import { useQuery } from '@tanstack/react-query';
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

function ago(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  const d = Math.floor(diff / 86400_000);
  return d === 1 ? '昨天' : `${d} 天前`;
}

function Platform({ p }) {
  if (!p) return null;
  const key = p === 'standalonewindows' ? 'pc' : p === 'android' ? 'quest' : p === 'ios' ? 'ios' : 'web';
  return <span className="plat" data-p={key}>{PLAT[p] ?? p}</span>;
}

/** 75 好友列表：friend 表全量，按信任等级 / 标签 / 收藏筛，显示最后在线 */
export default function FriendListPage() {
  // 86 筛选状态进地址栏（#/friendlist?trust=4&fav=1），刷新与深链都能还原
  const [f, setF] = useHashState({ q: '', trust: '', tag: '', fav: false, sort: 'last_seen', group: 'none' });
  const { q, trust, tag, fav, sort, group } = f;
  const setQ = (q) => setF({ q });
  const setTrust = (trust) => setF({ trust });
  const setTag = (tag) => setF({ tag });
  const setFav = (fn) => setF({ fav: typeof fn === 'function' ? fn(fav) : fn });
  const setSort = (sort) => setF({ sort });
  const setGroup = (group) => setF({ group });
  const active = [q, trust, tag, fav ? '1' : '', sort !== 'last_seen' ? '1' : '', group !== 'none' ? '1' : ''].filter(Boolean).length;
  const { openFriend } = useDrawer();

  const params = new URLSearchParams({ limit: '2000', sort });
  if (q) params.set('q', q);
  if (trust) params.set('trust', trust);
  if (tag) params.set('tag', tag);
  if (fav) params.set('favorite', '1');
  const { data, isLoading } = useQuery({
    queryKey: ['friend-list', q, trust, tag, fav, sort],
    queryFn: () => api(`friend-list?${params.toString()}`)
  });

  const rows = data?.friends ?? [];
  const tagOptions = data?.tags ?? [];

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名字 / user id"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-56 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={trust} onChange={(e) => setTrust(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部信任等级</option>
          {[4, 3, 2, 1].map((r) => <option key={r} value={String(r)}>{TRUST_NAME[r]}</option>)}
        </select>
        <select className="h-8 max-w-[160px] rounded-lg border px-2 text-[12px]" value={tag} onChange={(e) => setTag(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部标签</option>
          {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setFav((v) => !v)}
          className="chip"
          style={fav ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
        >
          {fav ? '★ 只看收藏' : '☆ 只看收藏'}
        </button>
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={sort} onChange={(e) => setSort(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="last_seen">按最后在线</option>
          <option value="name">按名字</option>
          <option value="trust">按信任等级</option>
        </select>
        {/* 107 分组：世界 / 收藏 / 信任等级，组头带计数 */}
        <select
          className="h-8 rounded-lg border px-2 text-[12px]"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          data-group={group}
          aria-label="分组方式"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}
        >
          {Object.entries(GROUP_MODES).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <span className="text-[12px] text-fg3" data-count="1">
          {data?.returned ?? 0} / {data?.total ?? 0} 人 · 在线 {data?.online ?? 0}
          {active ? ` · 已筛 ${active} 项` : ''}
        </span>
        {active ? (
          <button className="chip" data-reset="1" onClick={() => setF({ q: '', trust: '', tag: '', fav: false, sort: 'last_seen' })}>
            清空筛选
          </button>
        ) : null}
      </div>

      {isLoading ? <Skeleton rows={8} cols={5} /> : null}

      {!isLoading && rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">没有匹配的好友</div>
          <div className="mt-1 text-[12px] text-fg3">换个筛选条件试试。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>好友</th>
                <th style={{ width: 96 }}>信任等级</th>
                <th>标签</th>
                <th style={{ width: 96 }}>平台</th>
                <th style={{ width: 110 }}>最后在线</th>
              </tr>
            </thead>
            <tbody>
              {groupFriends(rows, group).map((g) => [
                g.label ? (
                  <tr key={`grp-${g.key}`} className="group-row" data-group-key={g.key} data-group-count={g.count}>
                    <td colSpan={5}>
                      <span className="font-medium">{g.label}</span>
                      <span className="ml-2 tabular-nums text-fg3">{g.count} 人</span>
                    </td>
                  </tr>
                ) : null,
                ...g.rows.map((f) => (
                <tr key={f.user_id} onClick={() => openFriend(f.user_id)} className="cursor-pointer">
                  <td>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="avatar">
                        {f.icon_url ? <img src={imgUrl(f.icon_url)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                        <span className="dot" style={{ background: STATUS_COLOR[f.status] ?? 'var(--status-offline)' }} />
                      </span>
                      <span className="min-w-0 truncate">{f.display_name}</span>
                      {f.favorite ? <span className="shrink-0 text-[11px]" style={{ color: 'var(--status-joinme)' }}>★</span> : null}
                      {f.online ? <span className="shrink-0 text-[11px] text-fg3">在线</span> : null}
                    </span>
                  </td>
                  <td className="text-[12px] text-fg2">{TRUST_NAME[f.trust_rank] ?? '—'}</td>
                  <td className="min-w-0 text-[12px] text-fg3">
                    {f.tags.length ? f.tags.join(' / ') : '—'}
                  </td>
                  <td><Platform p={f.platform} /></td>
                  <td className="text-[12px] tabular-nums text-fg3">{f.online ? '现在' : ago(f.last_seen)}</td>
                </tr>
                ))
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
