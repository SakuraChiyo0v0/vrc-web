import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl, send } from '../api.js';
import { useDrawer } from './drawers.jsx';

const KIND = {
  online: '上线',
  active: '活跃',
  offline: '下线',
  location: '换房',
  profile: '资料变更',
  friend_add: '加好友',
  friend_delete: '删好友'
};

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

function locLabel(p) {
  if (!p?.location) return '未知';
  if (p.location === 'offline') return '离线';
  if (p.location === 'private') return '私密世界';
  if (p.location === 'traveling') return '切换中';
  return p.world_name || p.location;
}

/** 42 本地备注 + 标签：只写我们自己的库，VRChat 那边不会变 */
function NoteAndTags({ id }) {
  const qc = useQueryClient();
  const enc = encodeURIComponent(id);
  const { data: noteData } = useQuery({ queryKey: ['friend-note', id], queryFn: () => api(`friend/${enc}/note`) });
  const { data: tagData } = useQuery({ queryKey: ['friend-tags', id], queryFn: () => api(`friend/${enc}/tags`) });
  const [text, setText] = useState(null);
  const [tag, setTag] = useState('');
  const [err, setErr] = useState('');

  const value = text ?? noteData?.note ?? '';
  const save = useMutation({
    mutationFn: () => send(`friend/${enc}/note`, 'PUT', { note: value }),
    onSuccess: () => { setText(null); setErr(''); qc.invalidateQueries({ queryKey: ['friend-note', id] }); },
    onError: (e) => setErr(e.message)
  });
  const tagMut = useMutation({
    mutationFn: ({ t, action }) => send(`friend/${enc}/tag`, 'POST', { tag: t, action }),
    onSuccess: (_, v) => { if (v.action === 'add') setTag(''); setErr(''); qc.invalidateQueries({ queryKey: ['friend-tags', id] }); },
    onError: (e) => setErr(e.message)
  });

  const tags = tagData?.tags ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="label-xs mb-1.5">备注（只存本地）</div>
        <textarea
          value={value}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="记得怎么认识的、聊过什么…"
          className="w-full resize-y rounded-lg border px-2.5 py-1.5 text-[12px] outline-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-raised)', color: 'var(--content-primary)' }}
        />
        <div className="mt-1 flex items-center justify-end gap-2">
          <button className="chip" disabled={save.isPending || text === null || value === (noteData?.note ?? '')} onClick={() => save.mutate()}>
            {save.isPending ? '保存中…' : '保存备注'}
          </button>
        </div>
      </div>

      <div>
        <div className="label-xs mb-1.5">标签</div>
        <div className="mb-1.5 flex flex-wrap gap-1">
          {tags.length === 0 ? <span className="text-[11px] text-fg3">还没有标签</span> : null}
          {tags.map((t) => (
            <button
              key={t}
              className="chip"
              title="点一下移除"
              onClick={() => tagMut.mutate({ t, action: 'remove' })}
            >
              {t} <span className="opacity-50">×</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) tagMut.mutate({ t: tag.trim(), action: 'add' }); }}
            placeholder="加标签，回车"
            className="h-7 min-w-0 flex-1 rounded-lg border px-2 text-[11.5px] outline-none"
            style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-raised)', color: 'var(--content-primary)' }}
          />
          <button className="chip" disabled={!tag.trim() || tagMut.isPending} onClick={() => tagMut.mutate({ t: tag.trim(), action: 'add' })}>
            添加
          </button>
        </div>
      </div>
      {err ? <div className="text-[11px]" style={{ color: 'var(--status-busy)' }}>{err}</div> : null}
    </div>
  );
}

/** 好友详情抽屉：资料 / 最近事件 / 常一起出现的世界 */
export default function FriendDrawer({ id, onClose }) {
  const { openWorld } = useDrawer();
  const { data, isLoading, error } = useQuery({ queryKey: ['friend', id], queryFn: () => api(`friend/${encodeURIComponent(id)}`) });
  const p = data?.profile;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,.28)' }} onClick={onClose}>
      <aside
        className="flex h-full w-[400px] max-w-[92vw] flex-col gap-3 overflow-auto border-l p-4"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="avatar" style={{ width: 40, height: 40 }}>
              {p?.icon_url ? <img src={imgUrl(p.icon_url)} alt="" loading="lazy" /> : null}
            </span>
            <div className="min-w-0">
              <div className="label-xs">好友</div>
              <div className="truncate text-[14px] font-medium">{p?.display_name ?? id}</div>
              <div className="truncate text-[11px] text-fg3">{locLabel(p)}</div>
            </div>
          </div>
          <button className="chip" onClick={onClose}>关闭</button>
        </div>

        {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}
        {error && <div className="card p-4 text-[12px] text-fg3">读不到这个好友：{error.message}</div>}

        {data ? (
          <>
            <div className="card px-3 py-2 text-[12px] leading-relaxed">
              <div className="flex justify-between gap-3"><span className="text-fg3">状态</span><span className="truncate">{p?.status ?? '—'}{p?.status_description ? `「${p.status_description}」` : ''}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">平台</span><span>{p?.platform ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">信任等级</span><span>{p?.trust_level ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">同房次数</span><span className="tabular-nums">{data.meets ?? 0}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">最近更新</span><span>{fmt(p?.updated_at)}</span></div>
            </div>

            <NoteAndTags id={id} />

            <div>
              <div className="label-xs mb-1.5">常一起出现的世界</div>
              {(data.worlds ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[11.5px] text-fg3">还没有共同出现过的世界。</div>
              ) : (
                (data.worlds ?? []).map((w) => (
                  <button
                    key={w.world}
                    onClick={() => w.world_id && openWorld(w.world_id)}
                    className="card mb-1 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--state-hover-surface)]"
                  >
                    <span className="min-w-0 truncate text-[12.5px]">{w.world}</span>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-fg3">{w.meets} 次</span>
                  </button>
                ))
              )}
            </div>

            <div>
              <div className="label-xs mb-1.5">最近事件</div>
              {(data.events ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[11.5px] text-fg3">这个好友还没有事件记录。</div>
              ) : (
                (data.events ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-1 py-1 text-[11.5px]">
                    <span className="flex items-center gap-2">
                      <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>{KIND[e.kind] ?? e.kind}</span>
                      <span className="truncate text-fg2">{e.world_name ?? e.location ?? '—'}</span>
                    </span>
                    <span className="shrink-0 text-fg3">{fmt(e.at)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
