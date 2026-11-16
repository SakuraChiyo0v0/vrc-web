import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

const DAYS = [7, 30];

/** 24 小时 × N 天热力图：颜色按该窗口最大值归一 */
function Heatmap({ dates, hourly, max }) {
  if (!dates?.length || !hourly?.length) return <div className="p-4 text-[12px] text-fg3">暂无数据</div>;
  return (
    <div className="overflow-x-auto p-4">
      <div className="min-w-[560px]">
        <div className="mb-1 flex items-center gap-1 pl-[52px] text-[11px] text-fg3">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="w-[16px] text-center tabular-nums">
              {h % 3 === 0 ? h : ''}
            </span>
          ))}
        </div>
        {dates.map((d, i) => (
          <div key={d} className="mb-0.5 flex items-center gap-1">
            <span className="w-[48px] shrink-0 text-[11px] tabular-nums text-fg3">{d.slice(5)}</span>
            {hourly[i].map((n, h) => {
              const r = Math.min(1, n / max);
              return (
                <span
                  key={h}
                  title={`${d} ${String(h).padStart(2, '0')}:00 · ${n} 条`}
                  className="h-[14px] w-[16px] rounded-[3px]"
                  style={{
                    background: n === 0 ? 'var(--surface-raised)' : `color-mix(in oklab, var(--primary) ${18 + r * 82}%, transparent)`
                  }}
                />
              );
            })}
            <span className="ml-1 text-[11px] tabular-nums text-fg3">{hourly[i].reduce((a, b) => a + b, 0)}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1.5 pl-[52px] text-[11px] text-fg3">
          <span>少</span>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <span
              key={r}
              className="h-[10px] w-[16px] rounded-[2px]"
              style={{ background: r === 0 ? 'var(--surface-raised)' : `color-mix(in oklab, var(--primary) ${18 + r * 82}%, transparent)` }}
            />
          ))}
          <span>多 · 峰值 {max}</span>
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [days, setDays] = useState(7);
  const { data } = useQuery({ queryKey: ['stats', days], queryFn: () => api(`stats?days=${days}`) });
  const byKind = data?.byKind ?? [];
  const worlds = data?.topWorlds ?? [];
  const total = byKind.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...byKind.map((x) => x.n));

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-1.5">
        {DAYS.map((d) => (
          <button key={d} onClick={() => setDays(d)} className="chip" data-active={days === d}>
            近 {d} 天
          </button>
        ))}
        <span className="ml-auto text-[11px] text-fg3">
          共 {data?.total ?? 0} 条事件 · 时区 {data?.tz ?? '+08:00'}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--stroke-subtle)' }}>
            <span className="text-[12px] font-medium">活跃热力图 · 近 {days} 天 × 24 小时</span>
            <span className="text-[12px] text-fg3">{data?.total ?? 0}</span>
          </div>
          <Heatmap dates={data?.dates ?? []} hourly={data?.hourly ?? []} max={data?.max ?? 1} />
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--stroke-subtle)' }}>
            <span className="text-[12px] font-medium">近 {days} 天事件构成</span>
            <span className="text-[12px] text-fg3">{total}</span>
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
          <div className="border-b px-4 py-2.5 text-[12px] font-medium" style={{ borderColor: 'var(--stroke-subtle)' }}>
            最热闹的世界
          </div>
          <div className="p-2">
            {worlds.length === 0 && <div className="p-2 text-[12px] text-fg3">暂无数据</div>}
            {worlds.map((w) => (
              <div key={w.world} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--state-hover-surface)]">
                <span className="truncate text-[12px]">{w.world ?? '未知'}</span>
                <span className="shrink-0 text-[11px] text-fg3">{w.people} 人 · {w.events} 次</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
