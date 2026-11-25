import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

/**
 * 活动（真机侧栏 row 19）。真机这一页是「今天进过的世界 / 同房的人」的当日汇总，
 * 数据来自 /api/activity（self_event 里 kind=location 的停留聚合，按 +08 切日）。
 * 我们没有单独的「活动」聚合表，就按真机语义直接展示当日聚合结果。
 */
export default function ActivityPage() {
  const { data, isLoading } = useQuery({ queryKey: ['activity'], queryFn: () => api('activity') });
  const worlds = data?.worlds ?? [];
  const players = data?.players ?? [];
  const empty = !isLoading && worlds.length === 0 && players.length === 0;
  return (
    <div className="p-4" data-page="activity">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">当天（+08）的进出记录与同房玩家。</span>
        <span className="chip ml-auto" data-count={worlds.length}>世界 {worlds.length}</span>
        <span className="chip" data-count={players.length}>玩家 {players.length}</span>
      </div>
      {empty ? (
        <Empty icon="clock" title="今天还没有活动记录" hint="进一次 VRChat 后这里会按世界汇总停留时长。" />
      ) : (
        <div className="space-y-4">
          {worlds.length ? (
            <section data-section="worlds">
              <div className="mb-1.5 text-[12px] font-medium">去过的世界</div>
              <div className="world-grid" data-grid="activity-worlds">
                {worlds.map((w) => (
                  <div key={w.world_id ?? w.world} className="card p-2.5" data-world={w.world_id ?? undefined}>
                    <div className="truncate text-[12px]">{w.world}</div>
                    <div className="mt-1 text-[11px] tabular-nums text-fg3">
                      {w.visits} 次 · {Math.round((w.minutes ?? 0) / 60 * 10) / 10} 小时
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {players.length ? (
            <section data-section="players">
              <div className="mb-1.5 text-[12px] font-medium">同房的玩家</div>
              <ul className="space-y-1">
                {players.map((p) => (
                  <li key={p.user_id ?? p.name} className="flex items-center gap-2 text-[12px]">
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto tabular-nums text-fg3">{p.meets ?? 0} 次</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
