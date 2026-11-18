import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import Empty from '../components/Empty.jsx';

/**
 * 77 概览：顶部「概览 / 旅程」+ 时间范围切换（规格取自 VRCX-0 真机截图）。
 *   主区：总时长 + 上一周期对比 + 每天平均 / 次上线 / 最久一次 + 每日时长柱 + 活跃时段 24h 柱
 *   右栏：相处最久的人（遇到过 N 人）/ 相处变少的人 / 常遇见的过路人
 * 数据全走 /api/overview；「旅程」是同一时间范围内的逐次停留，走 /api/game-log/days。
 */

const RANGES = [
  ['all', '全部'],
  ['30', '近30天'],
  ['90', '近90天'],
  ['180', '近180天'],
  ['365', '近365天'],
  ['custom', '自定义']
];

function dur(m) {
  const n = Math.round(Number(m ?? 0));
  if (n < 60) return `${n}分钟`;
  if (n < 1440) return `${Math.floor(n / 60)}小时${n % 60 ? `${n % 60}分` : ''}`;
  return `${Math.floor(n / 1440)}天${Math.floor((n % 1440) / 60)}小时`;
}

const hours = (m) => `${Math.round((Number(m ?? 0) / 60) * 10) / 10}`;

const md = (date) => {
  const [y, m, d] = String(date).split('-');
  return `${Number(m)}月${Number(d)}日${String(y) !== String(new Date().getFullYear()) ? ` ${y}` : ''}`;
};

const hm = (iso) =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

const ymd = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 85 空数据不画空轴：0 时长时只出一行空态，不渲染柱/轴 */
function DailyBars({ daily }) {
  const total = daily.reduce((s, d) => s + Number(d.minutes ?? 0), 0);
  if (!daily.length || total === 0) {
    return <Empty icon="clock" title={'这个范围内还没有停留时长，暂时画不出每日柱'} compact />;
  }
  const max = Math.max(1, ...daily.map((d) => d.minutes));
  const thin = daily.length > 60;
  return (
    <div className="ov-bars" role="img" aria-label="每日时长">
      {daily.map((d) => (
        <div key={d.date} className="ov-bar" title={`${md(d.date)} · ${dur(d.minutes)}`}>
          <span className="ov-bar-fill" style={{ height: `${Math.max(d.minutes ? 3 : 0, (d.minutes / max) * 100)}%` }} />
          {!thin && d.date.endsWith('-01') ? <span className="ov-bar-tick">{md(d.date)}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** 活跃时段：24 根柱 + 峰值钟点；85 全 0 时同样退化成一行空态 */
function HourBars({ hourly }) {
  const buckets = hourly?.buckets ?? [];
  const total = buckets.reduce((s, m) => s + Number(m ?? 0), 0);
  if (!buckets.length || total === 0) {
    return <Empty icon="clock" title={'这个范围内还没有活跃时段数据'} compact />;
  }
  const max = Math.max(1, ...buckets);
  const peak = hourly?.peak_hour ?? 0;
  return (
    <div className="ov-hbars" role="img" aria-label="活跃时段">
      {buckets.map((m, h) => (
        <div key={h} className="ov-hbar" title={`${h}:00 – ${h + 1}:00 · ${dur(m)}`} data-peak={h === peak ? 'true' : 'false'}>
          <span className="ov-hbar-fill" style={{ height: `${(m / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function People({ rows, empty, suffix, onClick }) {
  if (!rows?.length) return <p className="px-1 py-2 text-[12px] text-fg3">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.minutes ?? r.meets ?? 0));
  return (
    <div>
      {rows.map((r) => {
        const v = r.minutes ?? r.meets ?? 0;
        return (
          <button key={r.user_id ?? r.name} className="ov-person" onClick={() => onClick?.(r)} disabled={!onClick}>
            <span className="ov-person-name">{r.name}</span>
            <span className="ov-person-val tabular-nums">
              {suffix(v)}
              {r.drop ? <em className="ov-drop"> −{r.drop}%</em> : null}
            </span>
            <span className="ov-person-bar" style={{ width: `${Math.round((v / max) * 100)}%` }} />
          </button>
        );
      })}
    </div>
  );
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 92 旅程：按「月 → 日」分组的长时间轴（真机概览页第二个 tab）。
 * 每月一行统计，下面是当天总时长 + 时长条；点一天展开当天的逐次停留。
 */
function Journey({ days, openWorld }) {
  const [open, setOpen] = useState(null);

  const months = useMemo(() => {
    const m = new Map();
    for (const d of days) {
      const key = String(d.date).slice(0, 7);
      if (!m.has(key)) m.set(key, { key, days: [], minutes: 0 });
      const g = m.get(key);
      g.days.push(d);
      g.minutes += Number(d.minutes ?? 0);
    }
    return [...m.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((g) => {
        g.days.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        g.max = Math.max(1, ...g.days.map((d) => Number(d.minutes ?? 0)));
        return g;
      });
  }, [days]);

  if (!months.length) {
    return <p className="px-3 py-4 text-[12px] text-fg3">这个范围内没有停留记录</p>;
  }

  return (
    <div className="jm-wrap" data-journey="months">
      {months.map((g) => (
        <section key={g.key} className="card overflow-hidden" data-month={g.key}>
          <div className="jm-head">
            <span className="text-[12px] font-medium tabular-nums">
              {g.key.slice(0, 4)} 年 {Number(g.key.slice(5, 7))} 月
            </span>
            <span className="text-[11px] text-fg3 tabular-nums">
              {g.days.length} 天 · {dur(g.minutes)}
            </span>
          </div>
          {g.days.map((d) => {
            const date = new Date(`${d.date}T12:00:00+08:00`);
            const rows = [];
            for (const w of d.worlds ?? []) {
              for (const v of w.visits ?? []) rows.push({ ...v, world_name: w.world_name, world_id: w.world_id });
            }
            rows.sort((a, b) => String(b.start_at).localeCompare(String(a.start_at)));
            const isOpen = open === d.date;
            return (
              <div key={d.date} className="jm-day" data-day={d.date}>
                <button
                  className="jm-dayrow"
                  data-open={isOpen ? 'true' : 'false'}
                  onClick={() => setOpen(isOpen ? null : d.date)}
                  title={`${d.date} · ${rows.length} 次停留`}
                >
                  <span className="w-[46px] shrink-0 text-[11px] tabular-nums">{md(d.date)}</span>
                  <span className="w-[34px] shrink-0 text-[11px] text-fg3">{WEEK[date.getDay()]}</span>
                  <span className="jm-daybar">
                    <span style={{ width: `${Math.round((Number(d.minutes ?? 0) / g.max) * 100)}%` }} />
                  </span>
                  <span className="w-[70px] shrink-0 text-right text-[11px] tabular-nums">{dur(d.minutes)}</span>
                  <span className="w-[44px] shrink-0 text-right text-[11px] text-fg3 tabular-nums">{rows.length} 次</span>
                </button>
                {isOpen ? (
                  <div className="jm-visits">
                    {rows.map((v, i) => (
                      <div key={`${v.start_at}-${i}`} className="ov-jrow">
                        <span className="w-[92px] shrink-0 text-[11px] text-fg3 tabular-nums">{hm(v.start_at)} – {hm(v.end_at)}</span>
                        <button className="min-w-0 flex-1 truncate text-left text-[12px]" onClick={() => openWorld?.(v.world_id)} title={v.world_name}>
                          {v.world_name}
                        </button>
                        <span className="w-[64px] shrink-0 text-right text-[11px] tabular-nums">{dur(v.minutes)}</span>
                        <span className="w-[52px] shrink-0 text-right text-[11px] text-fg3 tabular-nums">{(v.players ?? []).length} 人</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('all');
  const today = useMemo(() => ymd(new Date()), []);
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState(today);
  const { openFriend, openWorld } = useDrawer();

  // 自定义：用起止日期换算成「距今天数 + until」，后端只认 range=<days>&until=<iso>
  const days = range === 'custom'
    ? Math.max(1, Math.ceil((new Date(`${to}T23:59:59+08:00`) - new Date(`${from}T00:00:00+08:00`)) / 86400_000))
    : range === 'all' ? null : Number(range);
  const until = range === 'custom' ? new Date(`${to}T23:59:59+08:00`).toISOString() : undefined;
  const qs = days ? `overview?range=${days}${until ? `&until=${encodeURIComponent(until)}` : ''}` : 'overview?range=all';

  const { data, isLoading } = useQuery({ queryKey: ['overview', qs], queryFn: () => api(qs) });
  // 92 旅程跟同一时间范围：全部 → 3650 天（后端上限），否则按所选天数
  const jDays = range === 'all' ? 3650 : Math.max(1, Number(days) || 30);
  const { data: log } = useQuery({
    queryKey: ['game-log-days', jDays],
    queryFn: () => api(`game-log/days?days=${jDays}`),
    enabled: tab === 'journey'
  });

  const daily = data?.daily ?? [];
  const hourlyTotal = (data?.hourly?.buckets ?? []).reduce((s, m) => s + Number(m ?? 0), 0);
  const hasHourly = hourlyTotal > 0;
  const delta = data?.previous?.delta_pct;
  const selStyle = { borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' };

  return (
    <div className="p-4">
      {/* 顶部：概览 / 旅程 + 时间范围 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border" style={selStyle}>
          {[['overview', '概览'], ['journey', '旅程']].map(([k, label]) => (
            <button
              key={k}
              data-tab={k}
              data-active={tab === k}
              onClick={() => setTab(k)}
              className="ov-tab px-3 py-1 text-[12px]"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {RANGES.map(([k, label]) => (
            <button
              key={k}
              data-range={k}
              data-active={range === k}
              onClick={() => setRange(k)}
              className="ov-range px-2 py-1 text-[12px]"
              style={selStyle}
            >
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="flex items-center gap-1 text-[12px]">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border px-2 text-[12px]" style={selStyle} />
            <span className="text-fg3">→</span>
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border px-2 text-[12px]" style={selStyle} />
          </div>
        ) : null}
        <span className="ml-auto text-[11px] text-fg3 tabular-nums">
          {data?.range ? `${md(data.range.since.slice(0, 10))} – ${md(data.range.until.slice(0, 10))} · ${data.range.days} 天` : ''}
        </span>
      </div>

      {isLoading ? <p className="p-4 text-[12px] text-fg3">读取中…</p> : null}

      {tab === 'overview' && data ? (
        <div className="ov-shell">
          <div className="flex min-w-0 flex-col gap-3">
            {/* 总时长 + 上周期对比 */}
            <section className="card p-4">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <div>
                  <div className="label-xs">总时长</div>
                  <div className="ov-num">
                    {hours(data.total_minutes)}
                    <span className="ml-1 text-[14px] font-normal text-fg3">小时</span>
                  </div>
                </div>
                <div className="pb-1 text-[12px] text-fg3">
                  {delta === null || delta === undefined ? (
                    '上一周期没有记录，暂无对比'
                  ) : (
                    <>
                      比上一周期
                      <b className="ov-delta" data-dir={delta >= 0 ? 'up' : 'down'}>
                        {' '}{delta >= 0 ? '+' : ''}{delta}%{' '}
                      </b>
                      （{dur(data.previous.minutes)}）
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['每天平均', dur(data.avg_daily_minutes)],
                  ['次上线', `${data.sessions} 次`],
                  ['最久一次', `${dur(data.longest?.minutes)}${data.longest?.world_name ? ` · ${data.longest.world_name}` : ''}`]
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border px-2.5 py-2" style={selStyle}>
                    <div className="label-xs">{k}</div>
                    <div className="truncate text-[14px] font-medium tabular-nums" title={v}>{v}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 每日时长 */}
            <section className="card p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <div className="label-xs">每日时长</div>
                <div className="text-[11px] text-fg3 tabular-nums">
                  {daily.some((d) => Number(d.minutes ?? 0) > 0)
                    ? `${daily.length} 天 · 峰值 ${dur(Math.max(0, ...daily.map((d) => d.minutes)))}`
                    : '无数据'}
                </div>
              </div>
              <DailyBars daily={daily} />
            </section>

            {/* 活跃时段 */}
            <section className="card p-4">
              <div className="label-xs mb-1">活跃时段</div>
              {hasHourly ? (
                <>
                  <div className="flex items-end gap-3">
                    <div className="ov-num">
                      {String(data.hourly.peak_hour).padStart(2, '0')}:00
                      <span className="ml-1 text-[14px] font-normal text-fg3">前后</span>
                    </div>
                    <div className="pb-1.5 text-[12px] text-fg3">
                      这个钟点占全部时长的 <b className="tabular-nums">{data.hourly.peak_pct}%</b>
                    </div>
                  </div>
                  <HourBars hourly={data.hourly} />
                  <div className="ov-haxis text-fg3">
                    {['0', '3', '6', '9', '12', '15', '18', '21'].map((h) => <span key={h}>{h}</span>)}
                  </div>
                </>
              ) : (
                /* 85 全 0 不画 24 根空柱和 0:00 的假峰值 */
                <HourBars hourly={data.hourly} />
              )}
            </section>
          </div>

          {/* 右栏三块榜单 */}
          <aside className="flex min-w-0 flex-col gap-3">
            <section className="card p-3">
              <div className="mb-1 flex items-baseline justify-between">
                <div className="label-xs">相处最久的人</div>
                <span className="text-[11px] text-fg3 tabular-nums">遇到过 {data.people_met} 人</span>
              </div>
              <People rows={data.companions} empty="这个范围内没和谁同房过" suffix={dur} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
            <section className="card p-3">
              <div className="label-xs mb-1">相处变少的人</div>
              <People rows={data.shrinking} empty="没有明显变少的对象" suffix={dur} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
            <section className="card p-3">
              <div className="label-xs mb-1">常遇见的过路人</div>
              <People rows={data.passersby} empty="还没遇到重复的陌生人" suffix={(v) => `${v} 次`} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
          </aside>
        </div>
      ) : null}

      {tab === 'journey' ? <Journey days={log?.days ?? []} openWorld={openWorld} /> : null}
    </div>
  );
}
