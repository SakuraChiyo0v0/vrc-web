import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, send, shareUrl } from '../api.js';

const KIND_LABEL = { world: '世界', friend: '好友' };

function Thumb({ row }) {
  if (row.thumbnail) {
    return (
      <span className="avatar">
        <img src={row.thumbnail} alt="" loading="lazy" />
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

  const shown = favorites.filter((f) => {
    if (filter === 'all') return true;
    if (filter === 'none') return !f.group_id;
    return f.group_id === filter;
  });

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="chip" data-active={filter === 'all'} onClick={() => setFilter('all')}>
          全部 {favorites.length}
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
        <div className="card mb-3 truncate px-3 py-2 text-[11.5px] text-fg2" title={toast}>
          {toast}
        </div>
      )}

      {error && <div className="card p-4 text-[12px] text-fg2">{error.message}</div>}

      {shown.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[13px]">{favorites.length ? '这个分组还是空的' : '还没有收藏'}</div>
          <div className="mt-1 text-[11.5px] text-fg3">
            {favorites.length ? '把收藏项分到这个分组后就会显示。' : '在上面填世界 / 用户 ID 加一条，或从收藏的收藏里固定到侧栏。'}
          </div>
        </div>
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
                        {f.location && <span className="block truncate text-[10.5px] text-fg3">{f.location}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="text-[11.5px] text-fg3">{KIND_LABEL[f.kind] ?? f.kind}</td>
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
