import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';
import Empty from '../components/Empty.jsx';
import { dayVisits, groupMonths, monthLabel, monthOf } from '../lib/journey.js';

/**
 * 77 概览：顶部「概览 / 旅程」+ 时间范围切换（规格取自 VRCX-0 真机截图）。
 *   主区：总时长 + 上一周期对比 + 每天平均 / 次上线 / 最久一次 + 每日时长柱 + 活跃时段 24h 柱
 *   右栏：相处最久的人（遇到过 N 人）/ 相处变少的人 / 常遇见的路人
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

/** 85 空数据不画空轴：0 时长时只出一行空态，不渲染柱/轴；182 每根柱可点，跳到旅程该天 */
function DailyBars({ daily, onPick }) {
  const total = daily.reduce((s, d) => s + Number(d.minutes ?? 0), 0);
  if (!daily.length || total === 0) {
    return <Empty icon="clock" title={'这个范围内还没有停留时长，暂时画不出每日柱'} compact />;
  }
  const max = Math.max(1, ...daily.map((d) => d.minutes));
  const thin = daily.length > 60;
  return (
    <div className="ov-bars" role="img" aria-label="每日时长">
      {daily.map((d) => (
        <button
          key={d.date}
          className="ov-bar"
          data-date={d.date}
          data-minutes={d.minutes}
          title={`${md(d.date)} · ${dur(d.minutes)}${onPick ? ' · 点击看当天' : ''}`}
          onClick={() => onPick?.(d.date)}
          disabled={!onPick}
        >
          <span className="ov-bar-fill" style={{ height: `${Math.max(d.minutes ? 3 : 0, (d.minutes / max) * 100)}%` }} />
          {!thin && d.date.endsWith('-01') ? <span className="ov-bar-tick">{md(d.date)}</span> : null}
        </button>
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

/**
 * 右栏榜单（规格见 docs/ref/overview-lists-measure.json）：
 *   首名 hero 行 = 116 圆头像 + 32px 字号名字 + 名字下方时长；紧凑行 = 50 圆头像 + 22px 名字 + 右侧 67px 灰色相对条。
 * 没有头像数据时用名字首字占位（不编假图）。
 */
function oav(r, name) {
  return r.icon_url || r.avatar || r.avatar_thumb || '';
}

function PersonRow({ r, hero, max, suffix, onClick }) {
  const v = Number(r.minutes ?? r.meets ?? 0);
  const av = oav(r);
  const label = suffix(v) + (r.drop ? ` · 少 ${r.drop}%` : '');
  return (
    <button
      className={`ov-person${hero ? ' ov-person-hero' : ''}`}
      data-hero={hero ? 'true' : 'false'}
      title={`${r.name} · ${label}`}
      onClick={() => onClick?.(r)}
      disabled={!onClick}
    >
      <span className="ov-av" aria-hidden="true">
        {av ? (
          <img src={imgUrl(av)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        ) : (
          <span className="ov-av-ch">{String(r.name ?? '?').trim().slice(0, 1)}</span>
        )}
      </span>
      <span className="ov-person-main">
        <span className="ov-person-name">{r.name}</span>
        {hero ? (
          <span className="ov-person-val tabular-nums">
            {suffix(v)}
            {r.drop ? <em className="ov-drop"> −{r.drop}%</em> : null}
          </span>
        ) : null}
      </span>
      {hero ? null : (
        <span className="ov-person-barzone" aria-hidden="true">
          <span className="ov-person-bar" style={{ width: `${Math.max(3, Math.round((v / max) * 67))}px` }} />
        </span>
      )}
    </button>
  );
}

function People({ rows, empty, suffix, onClick }) {
  if (!rows?.length) return <p className="px-1 py-2 text-[12px] text-fg3">{empty}</p>;
  // 真机：榜首 hero 不带条，其余行的灰条按「相对榜首」取长度（不是相对榜内最大紧凑行）
  const max = Math.max(1, Number(rows[0].minutes ?? rows[0].meets ?? 0));
  const [first, ...rest] = rows;
  return (
    <div className="ov-people">
      <PersonRow r={first} hero max={max} suffix={suffix} onClick={onClick} />
      {rest.map((r) => (
        <PersonRow key={r.user_id ?? r.name} r={r} max={max} suffix={suffix} onClick={onClick} />
      ))}
    </div>
  );
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 92/182 旅程：按「月 → 日」分组的长时间轴（真机概览页第二个 tab）。
 * 每月一行统计，点月份头折叠/展开（默认只展开最新一月）；点一天展开当天逐次停留。
 * 从概览的每日柱点过来时（focus），自动展开对应月份和当天并滚到该行。
 */
function Journey({ days, openWorld, focus }) {
  const [openDay, setOpenDay] = useState(null);
  // null = 默认只开最新月；用户点过月份头后以显式集合为准
  const [openMonths, setOpenMonths] = useState(null);
  const months = useMemo(() => groupMonths(days), [days]);

  useEffect(() => {
    if (!focus || !months.length) return;
    setOpenDay(focus);
    const key = monthOf(focus);
    setOpenMonths((prev) => {
      const base = new Set(prev ?? [months[0].key]);
      base.add(key);
      return base;
    });
    const t = setTimeout(() => {
      document.querySelector(`[data-day="${focus}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(t);
  }, [focus, months]);

  if (!months.length) {
    return <p className="px-3 py-4 text-[12px] text-fg3">这个范围内没有停留记录</p>;
  }

  const monthOpen = (key) => (openMonths ? openMonths.has(key) : key === months[0].key);
  const toggleMonth = (key) => {
    setOpenMonths((prev) => {
      const base = new Set(prev ?? [months[0].key]);
      if (base.has(key)) base.delete(key);
      else base.add(key);
      return base;
    });
  };

  return (
    <div className="jm-wrap" data-journey="months">
      {months.map((g) => {
        const isMonthOpen = monthOpen(g.key);
        const peak = g.days.reduce((a, d) => (Number(d.minutes ?? 0) > Number(a.minutes ?? 0) ? d : a), g.days[0]);
        return (
          <section key={g.key} className="card overflow-hidden" data-month={g.key} data-month-open={isMonthOpen ? 'true' : 'false'}>
            <div className="jm-head">
              <button
                className="jm-head-toggle"
                data-month-toggle={g.key}
                aria-expanded={isMonthOpen}
                onClick={() => toggleMonth(g.key)}
                title={isMonthOpen ? '收起这个月' : '展开这个月'}
              >
                <span className="jm-caret" data-open={isMonthOpen ? 'true' : 'false'}>▾</span>
                <span className="text-[12px] font-medium tabular-nums">{monthLabel(g.key)}</span>
                <span className="ml-auto text-[11px] text-fg3 tabular-nums">
                  {g.days.length} 天 · {dur(g.minutes)}
                </span>
              </button>
            </div>
            {isMonthOpen ? (
              <>
                {g.days.map((d) => {
                  const date = new Date(`${d.date}T12:00:00+08:00`);
                  const rows = dayVisits(d);
                  const isOpen = openDay === d.date;
                  return (
                    <div key={d.date} className="jm-day" data-day={d.date}>
                      <button
                        className="jm-dayrow"
                        data-open={isOpen ? 'true' : 'false'}
                        onClick={() => setOpenDay(isOpen ? null : d.date)}
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
                <div className="px-3 pb-1.5 text-[11px] text-fg3 tabular-nums" data-month-foot>
                  峰值 {md(peak.date)} · {dur(peak.minutes)}
                </div>
              </>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export default function OverviewPage() {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('all');
  // 182 从每日柱点进旅程时带过去的日期（只作为一次跳转信号）
  const [focus, setFocus] = useState(null);
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
              onClick={() => { setTab(k); if (k === 'overview') setFocus(null); }}
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
              <DailyBars daily={daily} onPick={(date) => { setFocus({ date }); setTab('journey'); }} />
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

          {/* 右栏三块榜单：真机是白底无卡片边框的平铺栏，标题24/首名32/行22（measure_json） */}
          <aside className="ov-rail">
            <section className="ov-sec" data-list="companions">
              <div className="ov-list-head">
                <div className="ov-list-title">相处最久的人</div>
                <span className="ov-list-sub tabular-nums">遇到过 {data.people_met} 人</span>
              </div>
              <People rows={data.companions} empty="这个范围内没和谁同房过" suffix={dur} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
            <section className="ov-sec" data-list="shrinking">
              <div className="ov-list-head"><div className="ov-list-title">相处变少的人</div></div>
              <People rows={data.shrinking} empty="没有明显变少的对象" suffix={dur} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
            <section className="ov-sec" data-list="passersby">
              <div className="ov-list-head"><div className="ov-list-title">常遇见的路人</div></div>
              <People rows={data.passersby} empty="还没遇到重复的陌生人" suffix={(v) => `${v} 次`} onClick={(r) => openFriend?.(r.user_id)} />
            </section>
          </aside>
        </div>
      ) : null}

      {tab === 'journey' ? <Journey days={log?.days ?? []} openWorld={openWorld} focus={focus?.date} /> : null}
    </div>
  );
}