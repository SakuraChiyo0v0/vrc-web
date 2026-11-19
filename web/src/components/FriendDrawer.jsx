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

/** 121 平台原文（standalonewindows / android …）不再直接给主人看 */
const PLATFORM = {
  standalonewindows: 'PC',
  android: 'Quest',
  ios: 'iOS',
  web: '网页'
};

/** 121 信任等级原文 system_trust_xxx → 中文档位（与 trust_rank 同源） */
const TRUST = {
  system_trust_visitor: ['游客', 1],
  system_trust_new_user: ['新用户', 1],
  system_trust_basic: ['基础', 2],
  system_trust_known: ['已知', 3],
  system_trust_trusted: ['信任', 4],
  system_trust_veteran: ['老玩家', 4],
  system_trust_intermediate: ['熟识', 4]
};

const platLabel = (p) => PLATFORM[p?.platform] ?? (p?.platform ? '其他' : '—');
const trustRank = (p) => p?.trust_rank ?? TRUST[p?.trust_level]?.[1] ?? 0;
const trustLabel = (p) => TRUST[p?.trust_level]?.[0] ?? (trustRank(p) ? `信任 ${trustRank(p)}` : '—');

const STATUS_LABEL = {
  active: '在线',
  'join me': '可加入',
  'ask me': '可询问',
  busy: '忙碌',
  offline: '离线'
};

/** 在线状态点：active 黄 / join me 蓝 / ask me 橙 / busy 红 / offline 灰（与列表 dot 同一份变量） */
function statusKey(p) {
  if (!p?.location || p.location === 'offline') return 'offline';
  const s = String(p.status ?? '');
  return STATUS_LABEL[s] ? s : 'active';
}

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

/** 122 复制：clipboard 不可用（http 内网/旧浏览器）时退回 textarea + execCommand */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 下面兜底 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function ActionButton({ act, label, value }) {
  const [msg, setMsg] = useState('');
  return (
    <button
      className="chip"
      data-act={act}
      title={value}
      onClick={async () => {
        const ok = await copyText(value);
        setMsg(ok ? '已复制' : '复制失败');
        setTimeout(() => setMsg(''), 1500);
      }}
    >
      {msg || label}
    </button>
  );
}

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
function Sessions({ id, limit = 6 }) {
  const { data: sess } = useQuery({
    queryKey: ['friend-sessions', id, limit],
    queryFn: () => api(`friend/${encodeURIComponent(id)}/sessions?limit=${limit}`)
  });
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

/**
 * 124 足迹：默认折叠，展开只看最近 10 条。
 * friend_event（上线/下线/换房）已经在动态页整批出现，这里不再重复列一遍，只留会话/到访/状态/资料。
 */
const FOOTPRINT_LIMIT = 10;

function Footprints({ id }) {
  const [open, setOpen] = useState(false);
  const { data: tl } = useQuery({
    queryKey: ['friend-timeline', id],
    queryFn: () => api(`friend/${encodeURIComponent(id)}/timeline?limit=60`)
  });
  const all = (tl?.items ?? []).filter((it) => it.type !== 'event');
  const items = all.slice(0, FOOTPRINT_LIMIT);
  return (
    <div data-footprints>
      <div className="flex items-center justify-between gap-2">
        <div className="label-xs">
          足迹<span className="ml-1 tabular-nums text-fg3">{all.length} 条</span>
        </div>
        <button className="chip" data-act="toggle-footprints" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? '收起' : `展开最近 ${FOOTPRINT_LIMIT} 条`}
        </button>
      </div>
      {!open ? (
        <div className="card mt-1.5 px-3 py-2 text-[12px] text-fg3">默认收起，点右侧展开最近 {FOOTPRINT_LIMIT} 条。</div>
      ) : items.length === 0 ? (
        <div className="card mt-1.5 px-3 py-2 text-[12px] text-fg3">还没有行为记录。</div>
      ) : (
        <div className="mt-1">
          {items.map((it, i) => (
            <div key={`${it.type}-${it.at}-${i}`} className="flex items-center justify-between gap-3 px-1 py-1 text-[12px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>
                  {TL_LABEL[it.type] ?? it.type}
                </span>
                <span className="truncate text-fg2">{tlText(it)}</span>
              </span>
              <span className="shrink-0 text-fg3">{fmt(it.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 52 常去的世界（来自会话访问明细） */
function VisitedWorlds({ id, limit = 6 }) {
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
        (worlds.worlds ?? []).slice(0, limit).map((w) => (
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

/** 123 数据 tab：把散落的数字收成一组，不和概览重复叙述 */
function Stats({ id, counts, meets }) {
  const { data: sess } = useQuery({
    queryKey: ['friend-sessions', id, 20],
    queryFn: () => api(`friend/${encodeURIComponent(id)}/sessions?limit=20`)
  });
  const { data: heat } = useQuery({ queryKey: ['friend-heatmap', id], queryFn: () => api(`friend/${encodeURIComponent(id)}/heatmap`) });
  const rows = [
    ['在线时长', sess?.total_minutes ? `${Math.round(sess.total_minutes / 60)} 小时` : '—'],
    ['在线段数', sess?.returned ?? counts.trips],
    ['到访世界', counts.data],
    ['同房次数', meets ?? 0],
    ['标签', counts.notes],
    ['最常时段', heat?.peak?.label ?? '—']
  ];
  return (
    <div className="stat-grid">
      {rows.map(([k, v]) => (
        <div key={k} className="card px-3 py-2">
          <div className="label-xs">{k}</div>
          <div className="mt-0.5 text-[14px] tabular-nums">{v}</div>
        </div>
      ))}
    </div>
  );
}

/** 71/123 抽屉 Tab：概览 / 足迹 / 数据 / 备注。面板首次点开才挂载（懒加载），切回不重载 */
const TABS = [
  ['overview', '概览'],
  ['trips', '足迹'],
  ['data', '数据'],
  ['notes', '备注']
];

export default function FriendDrawer({ id, onClose }) {
  const qc = useQueryClient();
  const { openWorld } = useDrawer();
  const { data, isLoading, error } = useQuery({ queryKey: ['friend', id], queryFn: () => api(`friend/${encodeURIComponent(id)}`) });
  const { data: favData } = useQuery({ queryKey: ['favorites'], queryFn: () => api('favorites') });
  const p = data?.profile;
  const [tab, setTab] = useState('overview');
  const [seen, setSeen] = useState(() => new Set(['overview']));
  // 头像加载失败（演示库假 id / 代理 403）时降级成首字母块，不露破图图标
  const [iconFail, setIconFail] = useState(null);
  const pick = (next) => {
    setTab(next);
    setSeen((s) => (s.has(next) ? s : new Set([...s, next])));
  };

  const counts = {
    overview: data?.counts?.events ?? data?.events?.length ?? 0,
    trips: data?.counts?.sessions ?? 0,
    data: data?.counts?.worlds ?? data?.worlds?.length ?? 0,
    notes: data?.counts?.tags ?? 0
  };

  const fav = (favData?.favorites ?? []).find((f) => f.kind === 'friend' && f.target_id === id);
  const favMut = useMutation({
    mutationFn: () => (fav ? send(`favorites/${fav.id}`, 'DELETE') : send('favorites', 'POST', { kind: 'friend', targetId: id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] })
  });

  const profileLink = `https://vrchat.com/home/user/${id}`;
  const icon = p?.icon_url ? imgUrl(p.icon_url) : '';
  const s = statusKey(p);
  const inst = p?.location && String(p.location).includes(':')
    ? String(p.location).slice(String(p.location).indexOf(':') + 1)
    : '';
  const worldLink = p?.world_id
    ? `https://vrchat.com/home/world/${p.world_id}${inst ? `?instance=${encodeURIComponent(inst)}` : ''}`
    : '';

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,.28)' }} onClick={onClose}>
      <aside
        className="flex h-full w-[440px] max-w-[92vw] flex-col gap-3 overflow-auto border-l p-4"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 121 抽屉头部：80px 头像 + 名字 + 在线状态点 + 平台/信任徽章 */}
        <div className="drawer-head" data-head data-s={s}>
          <span className="avatar drawer-avatar" style={{ width: 80, height: 80 }}>
            {icon ? <img src={icon} alt="" loading="lazy" onError={() => setIconFail(icon)} /> : null}
            {!icon || iconFail === icon ? (
              <span className="avatar-fallback" aria-hidden="true">{(p?.display_name ?? id ?? '?').slice(0, 1).toUpperCase()}</span>
            ) : null}
            <span className="dot drawer-dot" data-s={s} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[16px] font-medium">{p?.display_name ?? id}</span>
                  {p?.group_name ? <span className="badge shrink-0" data-kind="group" title={p.group_name}>{p.group_name}</span> : null}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-fg3">{locLabel(p)}</div>
              </div>
              <button className="chip" onClick={onClose}>关闭</button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="badge" data-kind="status" data-s={s}>{STATUS_LABEL[s] ?? '在线'}</span>
              <span className="badge" data-kind="platform">{platLabel(p)}</span>
              <span className="badge" data-kind="trust" data-rank={String(trustRank(p))}>{trustLabel(p)}</span>
            </div>
            {p?.status_description ? <div className="drawer-status-desc" title={p.status_description}>{p.status_description}</div> : null}
          </div>
        </div>

        {/* 122 操作行：复制主页链接 / 收藏 / 复制世界链接 */}
        {data ? (
          <div className="drawer-actions" data-actions>
            <ActionButton act="copy-profile" label="复制主页链接" value={profileLink} />
            <button
              className="chip"
              data-act="favorite"
              data-on={fav ? 'true' : 'false'}
              disabled={favMut.isPending}
              onClick={() => favMut.mutate()}
            >
              {fav ? '★ 已收藏' : '☆ 收藏'}
            </button>
            {worldLink ? <ActionButton act="copy-world" label="复制世界链接" value={worldLink} /> : <span />}
          </div>
        ) : null}

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

            {/* 概览：只放资料与画像；事件流在动态页，不在这里重复 */}
            <div hidden={tab !== 'overview'} className="flex flex-col gap-3" data-panel="overview">
              <div className="card px-3 py-2 text-[12px] leading-relaxed">
                <div className="flex justify-between gap-3"><span className="text-fg3">状态</span><span className="truncate">{p?.status ? (STATUS_LABEL[p.status] ?? p.status) : '—'}{p?.status_description ? `「${p.status_description}」` : ''}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">平台</span><span>{platLabel(p)}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">信任等级</span><span>{trustLabel(p)}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">同房次数</span><span className="tabular-nums">{data.meets ?? 0}</span></div>
                <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">最近更新</span><span>{fmt(p?.updated_at)}</span></div>
              </div>
              <Heatmap id={id} />
              <VisitedWorlds id={id} limit={5} />
            </div>

            {seen.has('trips') ? (
              <div hidden={tab !== 'trips'} className="flex flex-col gap-3" data-panel="trips">
                <Sessions id={id} limit={6} />
                <Footprints id={id} />
              </div>
            ) : null}

            {seen.has('data') ? (
              <div hidden={tab !== 'data'} className="flex flex-col gap-3" data-panel="data">
                <Stats id={id} counts={counts} meets={data.meets} />
                <VisitedWorlds id={id} limit={10} />
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
              <div hidden={tab !== 'notes'} data-panel="notes">
                <NoteAndTags id={id} />
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
