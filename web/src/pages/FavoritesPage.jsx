import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, send, shareUrl, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';

const KIND_LABEL = { world: '世界', friend: '好友' };

function Thumb({ row }) {
  if (row.thumbnail) {
    return (
      <span className="avatar">
        <img src={imgUrl(row.thumbnail)} alt="" loading="lazy" />
      </span>
    );
  }
  const ch = (row.name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span className="avatar">
      <span
        className="flex h-full w-full items-center justify-center text-[11px] font-medium"
        style={{ color: 'var(--content-tertiary)' }}
      >
        {ch}
      </span>
    </span>
  );
}

export default function FavoritesPage() {
  const qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['favorites'], queryFn: () => api('favorites') });
  // 91 三 tab：好友 / 世界 / 分组，避免两类收藏和分组定义混在一张表里
  const [tab, setTab] = useState('world');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState({ kind: 'world', targetId: '', note: '' });
  const [groupName, setGroupName] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const favorites = data?.favorites ?? [];
  const groups = data?.groups ?? [];

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['favorites'] });
    await qc.invalidateQueries({ queryKey: ['pinned'] });
  };

  const run = async (fn, okMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (okMsg) setToast(okMsg);
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(''), 2600);
    }
  };

  const save = (row, patchRow) =>
    run(
      () =>
        send('favorites', 'POST', {
          kind: row.kind,
          targetId: row.target_id,
          note: patchRow.note ?? row.note,
          groupId: patchRow.groupId !== undefined ? patchRow.groupId : row.group_id,
          pinned: patchRow.pinned !== undefined ? patchRow.pinned : row.pinned,
          sortOrder: row.sort_order,
        }),
      null,
    );

  const add = () =>
    run(async () => {
      const id = draft.targetId.trim();
      if (!id) throw new Error('填一个世界 ID 或用户 ID（usr_… / wrld_…）');
      await send('favorites', 'POST', { kind: draft.kind, targetId: id, note: draft.note.trim() || null });
      setDraft({ kind: draft.kind, targetId: '', note: '' });
    }, '已加入收藏');

  const shareAll = () =>
    run(async () => {
      const r = await send('shares', 'POST', { kind: 'favorites' });
      setToast(shareUrl(r.id));
      try {
        await navigator.clipboard.writeText(shareUrl(r.id));
      } catch {
        /* 剪贴板不可用就只显示链接 */
      }
    }, null);

  const kindRows = favorites.filter((f) => f.kind === tab);
  const shown = kindRows.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'none') return !f.group_id;
    return f.group_id === filter;
  });
  const counts = {
    world: favorites.filter((f) => f.kind === 'world').length,
    friend: favorites.filter((f) => f.kind === 'friend').length,
    group: groups.length
  };
  const ungrouped = favorites.filter((f) => !f.group_id);
  const groupMembers = (gid) => favorites.filter((f) => (f.group_id ?? null) === gid);

  return (
    <div className="p-4">
      {/* 91 三类分 tab：世界 / 好友 / 分组，tabs 上带数量 */}
      <div className="mb-2 flex items-center gap-1.5" role="tablist">
        {[
          ['world', '世界'],
          ['friend', '好友'],
          ['group', '分组']
        ].map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className="chip"
            data-active={tab === k}
            data-tab={k}
            onClick={() => { setTab(k); setFilter('all'); if (k !== 'group') setDraft((d) => ({ ...d, kind: k })); }}
          >
            {label} {counts[k]}
          </button>
        ))}
      </div>

      {tab !== 'group' ? (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="chip" data-active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 {kindRows.length}
        </button>
        <button className="chip" data-active={filter === 'none'} onClick={() => setFilter('none')}>
          未分组 {favorites.filter((f) => !f.group_id).length}
        </button>
        {groups.map((g) => (
          <button key={g.id} className="chip" data-active={filter === g.id} onClick={() => setFilter(g.id)}>
            {g.name} {g.count}
          </button>
        ))}
        <span className="mx-1 h-4 w-px" style={{ background: 'var(--stroke-subtle)' }} />
        <input
          className="inp"
          style={{ width: 130 }}
          placeholder="新分组名"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <button
          className="chip"
          disabled={!groupName.trim()}
          onClick={() =>
            run(async () => {
              await send('favorite-groups', 'POST', { name: groupName.trim() });
              setGroupName('');
            }, '分组已建')
          }
        >
          + 分组
        </button>
        <span className="flex-1" />
        <button className="chip" disabled={!favorites.length} onClick={shareAll}>
          分享收藏合集
        </button>
      </div>
      ) : null}

      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        <select className="inp" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
          <option value="world">世界</option>
          <option value="friend">好友</option>
        </select>
        <input
          className="inp flex-1"
          style={{ minWidth: 220 }}
          placeholder={draft.kind === 'world' ? 'wrld_…（世界 ID）' : 'usr_…（用户 ID）'}
          value={draft.targetId}
          onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          className="inp"
          style={{ width: 180 }}
          placeholder="备注（可选）"
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="chip" disabled={busy} onClick={add}>
          收藏
        </button>
      </div>

      {toast && (
        <div className="card mb-3 truncate px-3 py-2 text-[12px] text-fg2" title={toast}>
          {toast}
        </div>
      )}

      {error && <div className="card p-4 text-[12px] text-fg2">{error.message}</div>}

      {tab === 'group' ? (
        // 91 分组 tab：每个分组一张卡，列出成员（收藏名 + 类型），未分组单独一卡
        <div className="fav-groups">
          {[...groups.map((g) => ({ id: g.id, name: g.name, rows: groupMembers(g.id) })),
            { id: 'none', name: '未分组', rows: ungrouped }].map((g) => (
            <div key={g.id} className="card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] font-medium">{g.name}</span>
                <span className="shrink-0 text-[11px] text-fg3">{g.rows.length} 项</span>
              </div>
              {g.rows.length ? (
                <ul className="mt-2 space-y-1">
                  {g.rows.slice(0, 12).map((f) => (
                    <li key={f.id} className="flex min-w-0 items-center gap-1.5 text-[12px]">
                      <span className="truncate text-fg2">{f.name}</span>
                      <span className="shrink-0 text-[11px] text-fg3">{KIND_LABEL[f.kind] ?? f.kind}</span>
                    </li>
                  ))}
                  {g.rows.length > 12 ? <li className="text-[11px] text-fg3">…还有 {g.rows.length - 12} 项</li> : null}
                </ul>
              ) : (
                <div className="mt-2 text-[11px] text-fg3">{g.id === 'none' ? '所有收藏都分了组' : '这个分组还是空的'}</div>
              )}
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty icon="star" title={kindRows.length ? '这个分组还是空的' : `还没有收藏的${KIND_LABEL[tab] ?? '项目'}`} hint={kindRows.length ? '把收藏项分到这个分组后就会显示。' : '在上面填世界 / 用户 ID 加一条，或从收藏的收藏里固定到侧栏。'} />
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>名称</th>
                <th style={{ width: 56 }}>类型</th>
                <th style={{ width: 200 }}>备注</th>
                <th style={{ width: 130 }}>分组</th>
                <th style={{ width: 168 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Thumb row={f} />
                      <span className="min-w-0">
                        <span className="block truncate">{f.name}</span>
                        {f.location && <span className="block truncate text-[11px] text-fg3">{f.location}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="text-[12px] text-fg3">{KIND_LABEL[f.kind] ?? f.kind}</td>
                  <td>
                    <input
                      className="inp w-full"
                      defaultValue={f.note ?? ''}
                      placeholder="备注"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (f.note ?? '')) save(f, { note: v || null });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      className="inp w-full"
                      value={f.group_id ?? ''}
                      onChange={(e) => save(f, { groupId: e.target.value || null })}
                    >
                      <option value="">未分组</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="flex gap-1.5">
                      {f.kind === 'world' && (
                        <button
                          className="chip"
                          data-active={f.pinned}
                          title="固定到侧栏"
                          onClick={() => save(f, { pinned: !f.pinned })}
                        >
                          {f.pinned ? '已固定' : '固定'}
                        </button>
                      )}
                      <button
                        className="chip"
                        title="生成只读分享链接"
                        onClick={() =>
                          run(async () => {
                            const r = await send('shares', 'POST', { kind: 'world', targetId: f.target_id });
                            setToast(shareUrl(r.id));
                            try {
                              await navigator.clipboard.writeText(shareUrl(r.id));
                            } catch {
                              /* 同上 */
                            }
                          }, null)
                        }
                      >
                        分享
                      </button>
                      <button
                        className="chip"
                        title="取消收藏"
                        onClick={() => run(() => send(`favorites/${f.id}`, 'DELETE'), '已取消收藏')}
                      >
                        移除
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
