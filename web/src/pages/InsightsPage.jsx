import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 好友关系图，版式对齐真机 docs/ref/vrcx0-insights.png：
 * 工具栏（再次拉取 / 查找好友 / 重置）→ 力导向画布 → 左下浮动图例卡（圈子、点大小、连线、已获取 n、最少连接数滑块）。
 *
 * 数据只用本地能算出来的关系：players 的共处次数 + 最近所在世界。
 * 圈子 = 最近同世界的一群人；点大小 = 共处次数；连线 = 同一圈子内、共处次数相近的人。
 * 真机的「共同好友」需要 VRChat 在线接口，本地没有，所以图例写明这里用的是共处关系，不冒充共同好友。
 */
const W = 1000;
const H = 620;
const COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444', '#a855f7'];

function layout(players) {
  // 按最近世界分圈，圈内按共处次数排序；圈的半径随人数走，点半径随次数走
  const byWorld = new Map();
  for (const p of players) {
    const key = p.last_world ?? '未知世界';
    if (!byWorld.has(key)) byWorld.set(key, []);
    byWorld.get(key).push(p);
  }
  const clusters = [...byWorld.entries()]
    .map(([world, ps]) => ({ world, players: ps.sort((a, b) => b.meets - a.meets) }))
    .sort((a, b) => b.players.length - a.players.length)
    .slice(0, 6);
  const cx = W / 2;
  const cy = H / 2;
  const ring = Math.min(W, H) * 0.32;

  const nodes = [];
  clusters.forEach((c, ci) => {
    const a = (ci / clusters.length) * Math.PI * 2 - Math.PI / 2;
    const ox = cx + Math.cos(a) * ring;
    const oy = cy + Math.sin(a) * ring * 0.82;
    const maxMeets = Math.max(...c.players.map((p) => p.meets), 1);
    c.players.slice(0, 14).forEach((p, pi) => {
      const ga = (pi / Math.max(1, Math.min(c.players.length, 14))) * Math.PI * 2;
      const gr = 22 + Math.sqrt(pi) * 18;
      nodes.push({
        id: p.user_id ?? p.name,
        name: p.name,
        world: c.world,
        cluster: ci,
        meets: p.meets,
        r: 4 + Math.sqrt(p.meets / maxMeets) * 9,
        x: ox + Math.cos(ga) * gr,
        y: oy + Math.sin(ga) * gr * 0.9,
      });
    });
  });

  // 同一圈子里相邻的人连一条线（代表「同世界同房过」）
  const edges = [];
  for (const n of nodes) {
    const mates = nodes.filter((m) => m.cluster === n.cluster && m !== n);
    mates.slice(0, 3).forEach((m) => {
      if (n.id < m.id) edges.push({ a: n, b: m });
    });
  }
  return { nodes, edges, clusters };
}

export default function InsightsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ['insights-graph-players'], queryFn: () => api('players?min_meets=1') });
  const [q, setQ] = useState('');
  const [minLinks, setMinLinks] = useState(0);

  const players = data?.players ?? [];
  const graph = useMemo(() => layout(players), [players]);
  const links = useMemo(() => {
    const m = new Map();
    for (const e of graph.edges) {
      m.set(e.a.id, (m.get(e.a.id) ?? 0) + 1);
      m.set(e.b.id, (m.get(e.b.id) ?? 0) + 1);
    }
    return m;
  }, [graph]);
  const vis = graph.nodes.filter((n) => (links.get(n.id) ?? 0) >= minLinks);
  const visEdges = graph.edges.filter((e) => vis.includes(e.a) && vis.includes(e.b));
  const hit = q.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col p-4" data-page="insights">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="chip" style={{ background: 'var(--primary)', color: 'var(--background)' }} onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? '拉取中…' : '再次拉取'}
        </button>
        <input
          className="inp min-w-0 flex-1 sm:max-w-[260px]"
          placeholder="查找好友"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="查找好友"
        />
        <button className="chip ml-auto" onClick={() => { setQ(''); setMinLinks(0); }} title="重置筛选">重置</button>
      </div>

      {isLoading ? (
        <div className="text-[12px] text-fg3">加载中…</div>
      ) : players.length === 0 ? (
        <Empty icon="users" title="还没有可以成图的关系" hint="采集器记到更多同房事件后，这里会按最近同世界分圈画出来。" />
      ) : (
        <div className="graph-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="graph-canvas" role="img" aria-label="好友关系图" preserveAspectRatio="xMidYMid meet">
            {visEdges.map((e, i) => (
              <line
                key={i}
                x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                stroke="var(--stroke-default)" strokeWidth={1}
              />
            ))}
            {vis.map((n) => (
              <g key={n.id} data-node={n.id} opacity={hit && !n.name.toLowerCase().includes(hit) ? 0.15 : 1}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={COLORS[n.cluster % COLORS.length]} opacity={0.85} />
                <text x={n.x} y={n.y - n.r - 4} textAnchor="middle" fontSize="10" fill="var(--content-secondary)">
                  {hit && n.name.toLowerCase().includes(hit) ? n.name : n.name.slice(0, 8)}
                </text>
              </g>
            ))}
          </svg>

          <div className="graph-legend" data-graph-legend>
            <div className="mb-1 text-[11px] font-medium">圈子</div>
            {graph.clusters.map((c, i) => (
              <div key={c.world} className="graph-leg-row">
                <span className="graph-dot" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{c.world}</span>
                <span className="ml-auto tabular-nums text-fg3">{c.players.length}</span>
              </div>
            ))}
            {[...new Set(graph.nodes.map((n) => n.world))].length > graph.clusters.length ? (
              <div className="mt-1 text-[11px] text-fg3">另有 {new Set(graph.nodes.map((n) => n.world)).size - graph.clusters.length} 个世界的人未画</div>
            ) : null}
            <div className="mt-2 space-y-0.5 text-[11px] text-fg3">
              <div>点越大，同房次数越多</div>
              <div>连线 = 最近同一世界、同房遇到过</div>
              <div>按最近所在世界分圈</div>
            </div>
            <div className="mt-2 text-[11px] tabular-nums text-fg3" data-graph-count>
              已获取 {players.length} 位玩家
            </div>
            <label className="mt-1 flex items-center gap-2 text-[11px] text-fg3">
              最少连接数
              <input
                type="range" min="0" max="3" step="1" value={minLinks}
                onChange={(e) => setMinLinks(Number(e.target.value))}
                className="min-w-0 flex-1"
                data-slider="min-links"
              />
              <span className="tabular-nums">{minLinks}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
