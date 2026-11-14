import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export default function StatsPage() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: () => api('stats') });
  const byKind = data?.byKind ?? [];
  const worlds = data?.topWorlds ?? [];
  const total = byKind.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...byKind.map((x) => x.n));

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2">
      <section className="card">
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--stroke-subtle)' }}>
          <span className="text-[12.5px] font-medium">近 24 小时事件</span>
          <span className="text-[11.5px] text-fg3">{total}</span>
        </div>
        <div className="p-4">
          {byKind.length === 0 && <div className="text-[12px] text-fg3">暂无数据</div>}
          {byKind.map((k) => (
            <div key={k.kind} className="mb-2.5 flex items-center gap-3 text-[12px]">
              <span className="w-24 text-fg2">{k.kind}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-raised)' }}>
                <div className="h-full rounded-full" style={{ width: `${(k.n / max) * 100}%`, background: 'var(--primary)', opacity: 0.75 }} />
              </div>
              <span className="w-9 text-right tabular-nums text-fg3">{k.n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="border-b px-4 py-2.5 text-[12.5px] font-medium" style={{ borderColor: 'var(--stroke-subtle)' }}>
          最热闹的世界
        </div>
        <div className="p-2">
          {worlds.length === 0 && <div className="p-2 text-[12px] text-fg3">暂无数据</div>}
          {worlds.map((w) => (
            <div key={w.world} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--state-hover-surface)]">
              <span className="truncate text-[12.5px]">{w.world ?? '未知'}</span>
              <span className="shrink-0 text-[11px] text-fg3">{w.people} 人 · {w.events} 次</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
