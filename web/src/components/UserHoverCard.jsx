import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';

/** VRCX-0 UserHoverCard 是 400~500ms 悬停后弹迷你卡；本地取 500ms，移开立刻消失 */
export const HOVER_DELAY_MS = 500;

function MiniCard({ id, anchor }) {
  const { data, isLoading } = useQuery({ queryKey: ['friend', id], queryFn: () => api(`friend/${encodeURIComponent(id)}`) });
  const p = data?.profile;
  // 默认贴右下；靠近右/下边缘时翻到左侧/上方，避免出屏
  const W = 236;
  const H = 132;
  const left = anchor.x + W + 12 > window.innerWidth ? Math.max(8, anchor.x - W - 12) : anchor.x + 12;
  const top = anchor.y + H > window.innerHeight ? Math.max(8, anchor.y - H) : anchor.y;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-[10px] border p-2.5 text-[12px] shadow-lg"
      data-hovercard={id}
      style={{ left, top, width: W, background: 'var(--surface-panel)', borderColor: 'var(--stroke-strong)' }}
    >
      <div className="flex items-center gap-2">
        <span className="avatar" style={{ width: 32, height: 32 }}>
          {p?.icon_url ? <img src={imgUrl(p.icon_url)} alt="" loading="lazy" /> : null}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{p?.display_name ?? id}</div>
          <div className="truncate text-[11px] text-fg3">{p?.platform ?? '未知平台'} · {p?.trust_level ?? '—'}</div>
        </div>
      </div>
      <div className="mt-1.5 flex justify-between gap-2">
        <span className="text-fg3">状态</span>
        <span className="truncate">{isLoading ? '读取中…' : `${p?.status ?? '—'}${p?.status_description ? `「${p.status_description}」` : ''}`}</span>
      </div>
      <div className="mt-0.5 flex justify-between gap-2">
        <span className="text-fg3">位置</span>
        <span className="truncate">{p?.world_name ?? (p?.location === 'offline' ? '离线' : p?.location === 'private' ? '私密世界' : p?.location ?? '—')}</span>
      </div>
      <div className="mt-0.5 flex justify-between gap-2">
        <span className="text-fg3">同房</span>
        <span className="tabular-nums">{data?.meets ?? 0} 次</span>
      </div>
    </div>
  );
}

/**
 * 66 悬浮卡：包住头像/名字，悬停 500ms 弹迷你资料卡，移开消失。
 * 点击不拦截 —— 子元素的 onClick（开抽屉）照常生效。
 */
export default function UserHoverCard({ id, children }) {
  const [anchor, setAnchor] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!id) return children;

  const enter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnchor({ x: r.right, y: r.top }), HOVER_DELAY_MS);
  };
  const leave = () => {
    clearTimeout(timer.current);
    setAnchor(null);
  };

  return (
    <span className="inline-flex min-w-0 items-center" onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
      {children}
      {anchor ? <MiniCard id={id} anchor={anchor} /> : null}
    </span>
  );
}
