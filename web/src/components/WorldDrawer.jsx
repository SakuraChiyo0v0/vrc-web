import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import { useDrawer } from './drawers.jsx';

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
/** 官方大数字：12.3 万 / 4.5 亿，避免 8 位数横排溢出 */
const compact = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)} 亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)} 万`;
  return String(v);
};

/** 35 复制：clipboard 不可用（http 内网/旧浏览器）时退回 textarea + execCommand */
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

function CopyButton({ label, value }) {
  const [state, setState] = useState('');
  if (!value) return null;
  return (
    <button
      className="chip"
      title={value}
      onClick={async () => {
        const ok = await copyText(value);
        setState(ok ? '已复制' : '复制失败');
        setTimeout(() => setState(''), 1500);
      }}
    >
      {state || label}
    </button>
  );
}

/** 世界详情抽屉：作者 / 容量 / 在线好友 / 我去过几次 */
export default function WorldDrawer({ id, onClose }) {
  const { openFriend } = useDrawer();
  const { data, isLoading, error } = useQuery({ queryKey: ['world', id], queryFn: () => api(`world/${encodeURIComponent(id)}`) });

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: 'rgba(0,0,0,.28)' }} onClick={onClose}>
      <aside
        data-testid="world-drawer"
        className="flex h-full w-[400px] max-w-[92vw] flex-col gap-3 overflow-auto border-l p-4"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label-xs">世界</div>
            <div className="truncate text-[14px] font-medium">{data?.world?.name ?? id}</div>
            <div className="mt-0.5 text-[11px] text-fg3">{id}</div>
          </div>
          <button className="chip" onClick={onClose}>关闭</button>
        </div>

        {/* 35 世界链接：主页链接固定，实例链接要有活人在里面才有 */}
        <div className="flex flex-wrap gap-1.5">
          <CopyButton label="复制 VRChat 链接" value={`https://vrchat.com/home/world/${id}`} />
          <CopyButton
            label="复制实例链接"
            value={data?.instance ? `https://vrchat.com/home/launch?worldId=${id}&instanceId=${encodeURIComponent(data.instance)}` : ''}
          />
        </div>

        {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}
        {error && <div className="card p-4 text-[12px] text-fg3">读不到这个世界：{error.message}</div>}

        {data ? (
          <>
            {data.world?.thumbnail ? (
              <img src={imgUrl(data.world.thumbnail, 1024)} alt="" className="w-full rounded-[10px] border" style={{ borderColor: 'var(--stroke-subtle)' }} />
            ) : null}

            {/* 106 世界详情四格：官方访问量拉不到就显 — ，不拿本地数字冒充 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                ['世界访问', data.world.visits_total === null || data.world.visits_total === undefined ? '—' : compact(data.world.visits_total), 'visits_total'],
                ['在线好友', data.friends_online_count ?? data.online ?? 0, 'online'],
                ['我去过', `${data.visits ?? 0} 次`, 'visits'],
                ['圈内到访', `${data.friend_visits ?? 0} 次 · ${data.friends_visited ?? 0} 人`, 'friend_visits']
              ].map(([k, v, key]) => (
                <div key={k} className="card px-3 py-2" data-world-stat={key}>
                  <div className="label-xs">{k}</div>
                  <div className="mt-0.5 text-[14px] tabular-nums">{v}</div>
                </div>
              ))}
            </div>

            <div className="card px-3 py-2 text-[12px] leading-relaxed">
              <div className="flex justify-between gap-3" data-world-stat="author"><span className="text-fg3">作者</span><span className="truncate">{data.world.author_name ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3" data-world-stat="capacity"><span className="text-fg3">容量</span><span className="tabular-nums">{data.world.capacity ?? '—'}</span></div>
              <div className="mt-1 flex justify-between gap-3" data-world-stat="favorites"><span className="text-fg3">收藏</span><span className="tabular-nums">{data.world.favorites === null || data.world.favorites === undefined ? '—' : compact(data.world.favorites)}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">同房见过</span><span className="tabular-nums">{data.meets ?? 0} 人</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">累计停留</span><span className="tabular-nums">{data.minutes ?? 0} 分</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">首次到访</span><span>{data.first_at ? fmt(data.first_at) : fmt(data.friends_first_at)}</span></div>
              <div className="mt-1 flex justify-between gap-3"><span className="text-fg3">最近一次</span><span>{fmt(data.last_at)}</span></div>
            </div>

            <div>
              <div className="label-xs mb-1.5">此刻在这里的好友</div>
              {(data.online_friends ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[12px] text-fg3">现在没有好友在这个世界。</div>
              ) : (
                (data.online_friends ?? []).map((f) => (
                  <button
                    key={f.user_id}
                    onClick={() => openFriend(f.user_id)}
                    className="card mb-1 flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[var(--state-hover-surface)]"
                  >
                    <span className="avatar">
                      {f.icon_url ? <img src={imgUrl(f.icon_url)} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{f.display_name ?? f.user_id}</span>
                    <span className="text-[11px] text-fg3">{f.status ?? ''}</span>
                  </button>
                ))
              )}
            </div>

            <div>
              <div className="label-xs mb-1.5">我最近几次到访</div>
              {(data.recent ?? []).length === 0 ? (
                <div className="card px-3 py-2 text-[12px] text-fg3">还没有自己的到访记录。</div>
              ) : (
                (data.recent ?? []).map((r, i) => (
                  <div key={`${r.at}-${i}`} className="flex justify-between gap-3 px-1 py-1 text-[12px]">
                    <span className="text-fg3">{fmt(r.at)}</span>
                    <span className="tabular-nums">{r.minutes === null ? '未结束' : `${r.minutes} 分`}</span>
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
