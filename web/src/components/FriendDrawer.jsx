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
            className="h-7 min-w-0 flex-1 rounded-lg border px-2 text-[12px] outline-none"
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

/** 57 活跃热力图：7(周几) × 24(小时)，颜色深浅 = 该时段在线次数 */
function Heatmap({ id }) {
  const { data } = useQuery({ queryKey: ['friend-heatmap', id], queryFn: () => api(`friend/${encodeURIComponent(id)}/heatmap`) });
  if (!data?.hourly) return null;
  const max = data.max || 1;
  return (
    <div>
      <div className="label-xs mb-1.5 flex items-center justify-between">
        <span>活跃时段</span>
        <span className="text-fg3" style={{ fontWeight: 400 }}>
          近 {data.days} 天 · {data.based_on === 'sessions' ? '按在线区间' : '按事件'}
          {data.peak ? ` · 最常 ${data.peak.label}` : ''}
        </span>
      </div>
      <div className="card px-2 py-2">
        <div className="mb-1 flex items-center gap-[2px] pl-7 text-[11px] text-fg3">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="flex-1 text-center tabular-nums">{h % 6 === 0 ? h : ''}</span>
          ))}
        </div>
        {(data.weekdays ?? []).map((wd, d) => (
          <div key={wd} className="mb-[2px] flex items-center gap-[2px]">
            <span className="w-6 shrink-0 text-[11px] text-fg3">{wd}</span>
            {data.hourly[d].map((n, h) => (
              <span
                key={h}
                title={`${wd} ${String(h).padStart(2, '0')}:00 · ${n} 次`}
                className="h-[11px] flex-1 rounded-[2px]"
                style={{
                  background: n > 0 ? `rgba(94,160,255,${(0.12 + 0.78 * (n / max)).toFixed(2)})` : 'var(--surface-raised)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const TL_LABEL = { session: '在线', visit: '到访', status: '状态', change: '资料' };

function tlText(it) {
  if (it.type === 'event') return `${KIND[it.kind] ?? it.kind}${it.world ? ` · ${it.world}` : ''}`;
  if (it.type === 'session') return `${it.world ?? '在线'}${it.ongoing ? ' · 进行中' : ` · ${it.minutes} 分钟`}`;
  if (it.type === 'visit') return `${it.world}${it.minutes === null ? '' : ` · ${it.minutes} 分钟`}`;
  if (it.type === 'status') return `${it.description || it.status || '—'}`;
  return `${it.field}: ${it.old ?? '空'} → ${it.new ?? '空'}`;
}

/** 51 最近在线会话（一块块在线区间） */
function Sessions({ id }) {
  const { data: sess } = useQuery({ queryKey: ['friend-sessions', id], queryFn: () => api(`friend/${encodeURIComponent(id)}/sessions?limit=6`) });
  return (
    <div>
      <div className="label-xs mb-1.5 flex justify-between">
        <span>最近在线</span>
        <span className="text-fg3" style={{ fontWeight: 400 }}>
          {sess?.returned ? `共 ${sess.returned} 段 · ${Math.round((sess.total_minutes ?? 0) / 60)} 小时` : ''}
        </span>
      </div>
      {(sess?.sessions ?? []).length === 0 ? (
        <div className="card px-3 py-2 text-[12px] text-fg3">还没有会话记录。</div>
      ) : (
        (sess.sessions ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-1 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>{s.status ?? '在线'}</span>
              <span className="truncate text-fg2">{s.world ?? '—'}</span>
            </span>
            <span className="shrink-0 text-fg3 tabular-nums">
              {s.ongoing ? '进行中' : `${s.minutes} 分钟`} · {fmt(s.started_at)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/** 58 统一时间线（事件/会话/访问/状态/资料混排） */
function Timeline({ id }) {
  const { data: tl } = useQuery({ queryKey: ['friend-timeline', id], queryFn: () => api(`friend/${encodeURIComponent(id)}/timeline?limit=20`) });
  return (
    <div>
      <div className="label-xs mb-1.5">时间线</div>
      {(tl?.items ?? []).length === 0 ? (
        <div className="card px-3 py-2 text-[12px] text-fg3">还没有行为记录。</div>
      ) : (
        (tl.items ?? []).map((it, i) => (
          <div key={`${it.type}-${it.at}-${i}`} className="flex items-center justify-between gap-3 px-1 py-1 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>
                {it.type === 'event' ? (KIND[it.kind] ?? it.kind) : TL_LABEL[it.type]}
              </span>
              <span className="truncate text-fg2">{tlText(it)}</span>
            </span>
            <span className="shrink-0 text-fg3">{fmt(it.at)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/** 52 常去的世界（来自会话访问明细） */
function VisitedWorlds({ id }) {
  const { openWorld } = useDrawer();
  const { data: worlds } = useQuery({ queryKey: ['friend-worlds5', id], queryFn: () => api(`friend/${encodeURIComponent(id)}/worlds`) });
  return (
    <div>
      <div className="label-xs mb-1.5 flex justify-between">
        <span>常去的世界</span>
        <span className="text-fg3" style={{ fontWeight: 400 }}>{worlds?.returned ? `${worlds.returned} 个` : ''}</span>
      </div>
      {(worlds?.worlds ?? []).length === 0 ? (
        <div className="card px-3 py-2 text-[12px] text-fg3">还没有世界访问记录。</div>
      ) : (
        (worlds.worlds ?? []).slice(0, 6).map((w) => (
          <button
            key={w.world_id}
            onClick={() => w.world_id?.startsWith('wrld_') && openWorld(w.world_id)}
            className="card mb-1 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--state-hover-surface)]"
          >
            <span className="min-w-0 truncate text-[12px]">{w.world_name}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-fg3">
              {w.visits} 次 · {w.minutes} 分钟
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** 71 抽屉 Tab：概览 / 行程 / 常去 / 备注。标签带数量；面板首次点开才挂载（懒加载），切回不重载 */
const TABS = [
  ['overview', '概览'],
  ['trips', '行程'],
  ['worlds', '常去'],
  ['notes', '备注']
];

export default function FriendDrawer({ id, onClose }) {
  const { openWorld } = useDrawer();
  const { data, isLoading, error } = useQuery({ queryKey: ['friend', id], queryFn: () => api(`friend/${encodeURIComponent(id)}`) });
  const p = data?.profile;
  const [tab, setTab] = useState('overview');
  const [seen, setSeen] = useState(() => new Set(['overview']));
  const pick = (next) => {
    setTab(next);
    setSeen((s) => (s.has(next) ? s : new Set([...s, next])));
  };

  const counts = {
    overview: data?.counts?.events ?? data?.events?.length ?? 0,
    trips: data?.counts?.sessions ?? 0,
    worlds: data?.counts?.worlds ?? data?.worlds?.length ?? 0,
    notes: data?.counts?.tags ?? 0
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,.28)' }} onClick={onClose}>
      <aside
        className="flex h-full w-[420px] max-w-[92vw] flex-col gap-3 overflow-auto border-l p-4"
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
            <div className="flex flex-wrap gap-1 border-b pb-2" style={{ borderColor: 'var(--stroke-subtle)' }} role="tablist">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  data-tab={key}
                  aria-selected={tab === key}
                  className="chip"
                  style={tab === key ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
                  onClick={() => pick(key)}
                >
                  {label}
                  <span className="ml-1 tabular-nums opacity-60">{counts[key]}</span>
                </button>
              ))}
            </div>

            <div hidden={tab !== 'overview'} className="flex flex-col gap-3">
              <div className="card px-3 py-2 text-[12px] leading-relaxed">
                <div className="flex justify-between gap-3"><span className="text-fg3">状态</span><span className="truncate">{p?.status ?? '—'}{p?.status_description ? `「${p.status_description}」` : ''}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">平台</span><span>{p?.platform ?? '—'}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">信任等级</span><span>{p?.trust_level ?? '—'}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">同房次数</span><span className="tabular-nums">{data.meets ?? 0}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">最近更新</span><span>{fmt(p?.updated_at)}</span></div>
              </div>

              <div>
                <div className="label-xs mb-1.5">最近事件</div>
                {(data.events ?? []).length === 0 ? (
                  <div className="card px-3 py-2 text-[12px] text-fg3">这个好友还没有事件记录。</div>
                ) : (
                  (data.events ?? []).slice(0, 12).map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 px-1 py-1 text-[12px]">
                      <span className="flex items-center gap-2">
                        <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>{KIND[e.kind] ?? e.kind}</span>
                        <span className="truncate text-fg2">{e.world_name ?? e.location ?? '—'}</span>
                      </span>
                      <span className="shrink-0 text-fg3">{fmt(e.at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {seen.has('trips') ? (
              <div hidden={tab !== 'trips'} className="flex flex-col gap-3">
                <Sessions id={id} />
                <Timeline id={id} />
              </div>
            ) : null}

            {seen.has('worlds') ? (
              <div hidden={tab !== 'worlds'} className="flex flex-col gap-3">
                <Heatmap id={id} />
                <VisitedWorlds id={id} />
                <div>
                  <div className="label-xs mb-1.5">常一起出现的世界</div>
                  {(data.worlds ?? []).length === 0 ? (
                    <div className="card px-3 py-2 text-[12px] text-fg3">还没有共同出现过的世界。</div>
                  ) : (
                    (data.worlds ?? []).map((w) => (
                      <button
                        key={w.world}
                        onClick={() => w.world_id && openWorld(w.world_id)}
                        className="card mb-1 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--state-hover-surface)]"
                      >
                        <span className="min-w-0 truncate text-[12px]">{w.world}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-fg3">{w.meets} 次</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {seen.has('notes') ? (
              <div hidden={tab !== 'notes'}>
                <NoteAndTags id={id} />
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
