import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 好友关系图（真机侧栏 row 20）。真机画的是「我 ↔ 好友」的连线图，线宽按一起玩过的次数。
 * 我们的数据源是 /api/insights 的 companions（近 90 天同房聚合：meets / active_days / top_world），
 * 所以这里用同一份真实数据画一张以我为中心的放射图：节点半径 ∝ 共处次数，悬停给世界名。
 */
const R = 150;
const CX = 190;
const CY = 170;

export default function FriendGraphPage() {
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: () => api('insights') });
  const items = data?.companions?.items ?? [];
  const max = Math.max(1, ...items.map((c) => c.meets ?? 0));
  const nodes = items.slice(0, 24).map((c, i) => {
    const angle = (i / Math.max(1, Math.min(items.length, 24))) * Math.PI * 2 - Math.PI / 2;
    const rad = 6 + 10 * ((c.meets ?? 0) / max);
    return { ...c, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), rad };
  });
  return (
    <div className="p-4" data-page="friendgraph">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">近 {data?.range?.days ?? 90} 天一起玩过的人，节点越大共处越多。</span>
        <span className="chip ml-auto" data-count={nodes.length}>共 {nodes.length} 位</span>
      </div>
      {!isLoading && nodes.length === 0 ? (
        <Empty icon="users" title="还没有同房关系" hint="有了房间日志之后这里会出现你和好友的连线。" />
      ) : (
        <svg viewBox="0 0 380 340" width="100%" role="img" aria-label="好友关系图" data-graph="friends" data-nodes={nodes.length}>
          {nodes.map((n) => (
            <g key={n.user_id ?? n.name} data-node={n.user_id ?? n.name}>
              <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="var(--stroke-subtle)" strokeWidth={Math.max(1, (n.meets / max) * 3)} />
              <circle cx={n.x} cy={n.y} r={n.rad} fill="var(--surface-panel)" stroke="var(--stroke-strong)" strokeWidth="1.2" />
              <text x={n.x} y={n.y + n.rad + 10} textAnchor="middle" fontSize="9" fill="var(--content-tertiary)">
                {n.name}
                {n.meets ? ` · ${n.meets}` : ''}
              </text>
              <title>{`${n.name} · 共处 ${n.meets ?? 0} 次 · 常去 ${n.top_world ?? '—'}`}</title>
            </g>
          ))}
          <circle cx={CX} cy={CY} r="9" fill="var(--accent, #4c8dff)" />
          <text x={CX} y={CY + 22} textAnchor="middle" fontSize="10" fill="var(--content-secondary)">我</text>
        </svg>
      )}
    </div>
  );
}
