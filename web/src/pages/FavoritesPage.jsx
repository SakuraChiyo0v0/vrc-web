import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, send, shareUrl, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';

/**
 * 收藏页对齐真机 docs/ref/vrcx0-favorites.png：
 * 左栏「按日期排序」+ 在线收藏夹(分组, n/150) + 本地收藏夹(Favorites, n) + 创建新的收藏夹；
 * 右栏工具栏（搜索 / 刷新 / …）→ 分组标题 + n/150 → 2 列卡片网格（圆形头像 + 名字 + 所在世界）。
 * 分组 = 本地 favorite_group，收藏项 = favorite；上限 150 是 VRChat 在线收藏夹的硬限制。
 */
const CAP = 150;
const KIND = { world: '世界', friend: '好友' };
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—');

export default function FavoritesPage() {
  const qc = useQueryClient();
  const { openFriend, openWorld } = useDrawer();
  const { data, error, refetch, isFetching } = useQuery({ queryKey: ['favorites'], queryFn: () => api('favorites') });
  const [sel, setSel] = useState('all'); // 'all' | 'none' | groupId
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('date');
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: 'world', targetId: '', note: '' });
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const favorites = data?.favorites ?? [];
  const groups = data?.groups ?? [];

  const run = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['favorites'] });
      await qc.invalidateQueries({ queryKey: ['pinned'] });
      if (okMsg) setToast(okMsg);
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(''), 2600);
    }
  };

  const shown = useMemo(() => {
    let rows = favorites;
    if (sel === 'none') rows = rows.filter((f) => !f.group_id);
    else if (sel !== 'all') rows = rows.filter((f) => f.group_id === sel);
    const kw = q.trim().toLowerCase();
    if (kw) rows = rows.filter((f) => `${f.name} ${f.note ?? ''} ${f.location ?? ''}`.toLowerCase().includes(kw));
    const by = {
      date: (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
      name: (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-Hans-CN'),
      kind: (a, b) => String(a.kind).localeCompare(String(b.kind)) || String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'),
    };
    return [...rows].sort(by[sort] ?? by.date);
  }, [favorites, sel, q, sort]);

  const selName = sel === 'all' ? '全部收藏' : sel === 'none' ? '未分组' : groups.find((g) => g.id === sel)?.name ?? '收藏夹';

  const add = () =>
    run(async () => {
      const id = draft.targetId.trim();
      if (!id) throw new Error('填一个世界 ID 或用户 ID（wrld_… / usr_…）');
      await send('favorites', 'POST', {
        kind: draft.kind, targetId: id, note: draft.note.trim() || null,
        groupId: sel !== 'all' && sel !== 'none' ? sel : null,
      });
      setDraft({ kind: draft.kind, targetId: '', note: '' });
    }, '已加入收藏');

  const createGroup = () =>
    run(async () => {
      const name = groupName.trim();
      if (!name) throw new Error('先填收藏夹名字');
      const r = await send('favorite-groups', 'POST', { name });
      setGroupName('');
      setCreating(false);
      if (r?.id) setSel(r.id);
    }, '收藏夹已创建');

  const shareFolder = async () => {
    const r = await send('shares', 'POST', { kind: 'favorites' });
    setToast(shareUrl(r.id));
    try { await navigator.clipboard.writeText(shareUrl(r.id)); } catch { /* 剪贴板不可用时只显示链接 */ }
  };

  return (
    <div className="flex gap-3 p-4" data-page="favorites">
      {/* 左栏：排序 + 在线/本地收藏夹 */}
      <aside className="fav-side" data-folder-sidebar>
        <select className="inp mb-2 w-full" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序">
          <option value="date">按日期排序</option>
          <option value="name">按名称排序</option>
          <option value="kind">按类型排序</option>
        </select>

        <div className="fav-sec">
          <span>在线收藏夹</span>
          <span className="fav-badge">{groups.length}</span>
        </div>
        <button className="fav-folder" data-active={sel === 'all'} onClick={() => setSel('all')}>
          <span className="truncate">全部收藏</span>
          <span className="fav-cap">{favorites.length}/{favorites.length + CAP}</span>
        </button>
        {groups.map((g) => (
          <div key={g.id} className="fav-folder-row">
            <button className="fav-folder" data-active={sel === g.id} onClick={() => setSel(g.id)}>
              <span className="truncate">{g.name}</span>
              <span className="fav-cap">{g.count}/{CAP}</span>
            </button>
            <button
              className="fav-dots"
              title="删除收藏夹（收藏项会回到未分组）"
              onClick={() => run(() => send(`favorite-groups/${g.id}`, 'DELETE'), '收藏夹已删除')}
            >
              …
            </button>
          </div>
        ))}

        <div className="fav-sec mt-3">
          <span>本地收藏夹</span>
          <span className="fav-badge">1</span>
        </div>
        <button className="fav-folder" data-active={sel === 'none'} onClick={() => setSel('none')}>
          <span className="truncate">Favorites</span>
          <span className="fav-cap">{favorites.filter((f) => !f.group_id).length}</span>
        </button>

        {creating ? (
          <div className="mt-2 flex gap-1">
            <input
              className="inp min-w-0 flex-1"
              autoFocus
              placeholder="收藏夹名字"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
            />
            <button className="chip" disabled={busy} onClick={createGroup}>建</button>
          </div>
        ) : (
          <button className="fav-new" onClick={() => setCreating(true)}>+ 创建新的收藏夹</button>
        )}
      </aside>

      {/* 右栏：工具栏 + 分组标题 + 2 列卡片 */}
      <section className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            className="inp min-w-0 flex-1"
            placeholder="搜索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="搜索收藏"
          />
          <button className="chip" onClick={() => refetch()} disabled={isFetching} title="刷新">{isFetching ? '刷新中…' : '刷新'}</button>
          <button className="chip" data-active={adding} onClick={() => setAdding((v) => !v)}>+ 收藏</button>
          <button className="chip" disabled={!favorites.length} onClick={shareFolder} title="生成只读分享链接">分享</button>
        </div>

        {adding ? (
          <div className="card mb-2 flex flex-wrap items-center gap-2 p-2.5">
            <select className="inp" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              <option value="world">世界</option>
              <option value="friend">好友</option>
            </select>
            <input
              className="inp min-w-0 flex-1"
              placeholder={draft.kind === 'world' ? 'wrld_…（世界 ID）' : 'usr_…（用户 ID）'}
              value={draft.targetId}
              onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <input
              className="inp"
              style={{ width: 140 }}
              placeholder="备注"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="chip" disabled={busy} onClick={add}>收藏</button>
          </div>
        ) : null}

        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{selName}</span>
          <span className="text-[11px] tabular-nums text-fg3" data-count={shown.length}>{shown.length}/{CAP}</span>
        </div>

        {toast ? <div className="card mb-2 truncate px-3 py-2 text-[12px] text-fg2" title={toast}>{toast}</div> : null}
        {error ? <div className="card p-4 text-[12px] text-fg2">{error.message}</div> : null}

        {shown.length === 0 ? (
          <Empty icon="star" title={favorites.length ? '这个收藏夹还是空的' : '还没有收藏'}
            hint={favorites.length ? '把收藏项拖到这个分组，或在上面「+ 收藏」加一条。' : '在上方「+ 收藏」填世界 / 用户 ID，或从世界抽屉里点收藏。'} />
        ) : (
          <div className="fav-grid" data-grid="favorites">
            {shown.map((f) => (
              <div
                key={f.id}
                className="fav-card"
                onClick={() => (f.kind === 'world' ? openWorld(f.target_id) : f.target_id && openFriend(f.target_id))}
                title={f.note ?? f.name}
              >
                <span className="fav-ava">
                  {f.thumbnail ? <img src={imgUrl(f.thumbnail)} alt="" loading="lazy" /> : (f.name ?? '?').slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium">{f.name}</span>
                    <span className="shrink-0 text-[11px] text-fg3">{KIND[f.kind] ?? f.kind}</span>
                  </span>
                  <span className="block truncate text-[11px] text-fg3">
                    {f.location ?? f.note ?? `收藏于 ${fmtDay(f.created_at)}`}
                  </span>
                </span>
                <button
                  className="chip shrink-0"
                  data-remove={f.id}
                  title="取消收藏"
                  onClick={(e) => { e.stopPropagation(); run(() => send(`favorites/${f.id}`, 'DELETE'), '已取消收藏'); }}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
