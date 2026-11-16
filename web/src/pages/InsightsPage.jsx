import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { hourBars, BAR_AREA_PX } from '../lib/viz.js';

function shortTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function Card({ title, hint, children }) {
  return (
    <section className="card">
      <div
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: 'var(--stroke-subtle)' }}
      >
        <span className="text-[12px] font-medium">{title}</span>
        {hint ? <span className="text-[11px] text-fg3">{hint}</span> : null}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <div className="p-2 text-[12px] text-fg3">{children}</div>;
}

/** 常一起玩 / 渐行渐远 / 最常遇到的时段，数据来自 /api/insights */
export default function InsightsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: () => api('insights') });

  if (isLoading) return <div className="p-4 text-[12px] text-fg3">加载中…</div>;

  const companions = data?.companions?.items ?? [];
  const fading = data?.fading?.items ?? [];
  const bars = hourBars(data?.hours?.items ?? []);
  const peak = bars.peak;
  const events = data?.range?.events ?? 0;

  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2">
      <Card title="常一起玩" hint={`近 ${data?.range?.days ?? 90} 天 · ${events} 次同房`}>
        {companions.length === 0 && <Empty>还没有足够数据</Empty>}
        {companions.map((p) => (
          <div
            key={p.user_id ?? p.name}
            className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--state-hover-surface)]"
          >
            <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-fg3">
              {p.meets} 次 · {p.active_days} 天 · 最近 {shortTime(p.last_seen)}
            </span>
          </div>
        ))}
      </Card>

      <Card title="渐行渐远" hint="以前常见，最近 21 天没遇到">
        {fading.length === 0 && <Empty>暂时没有这样的人</Empty>}
        {fading.map((p) => (
          <div
            key={p.user_id ?? p.name}
            className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[var(--state-hover-surface)]"
          >
            <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-fg3">
              {p.meets} 次 · 已 {p.days_since} 天没见
            </span>
          </div>
        ))}
      </Card>

      <Card title="最常遇到的时段" hint={peak === null || peak === undefined ? '暂无数据' : `${String(peak).padStart(2, '0')}:00 附近最多`}>
        {bars.empty ? (
          <Empty>这段时间还没有同房记录，等采集器攒够数据再画。</Empty>
        ) : (
          <>
            <div className="flex items-end gap-[3px] px-2 pb-1 pt-3" style={{ height: BAR_AREA_PX + 12 }}>
              {bars.bars.map((h) => (
                <div
                  key={h.hour}
                  className="flex flex-1 flex-col items-center justify-end"
                  title={`${String(h.hour).padStart(2, '0')}:00 · ${h.n} 次`}
                  data-hour={h.hour}
                  data-n={h.n}
                >
                  <div
                    className="w-full rounded-[2px]"
                    style={{ height: h.px, background: 'var(--primary)', opacity: h.opacity }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between px-2 text-[11px] tabular-nums text-fg3">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </>
        )}
      </Card>

      <Card title="待补" hint="后续观察项">
        <Empty>共同世界、聊天热度等指标等数据够了再加，避免用样本不足的数字下结论。</Empty>
      </Card>
    </div>
  );
}
