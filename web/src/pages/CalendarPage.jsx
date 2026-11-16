import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

const KIND = {
  online: '上线',
  active: '活跃',
  offline: '下线',
  location: '换房',
  profile: '资料变更',
  friend_add: '加好友',
  friend_delete: '删好友',
  self_profile: '自己变更'
};

const fmtTime = (v) => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 当月 1 号是周几、多少天，本地时区算（跟服务端 +08:00 一致） */
function monthMeta(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  return { first, days, weekday: first.getDay() };
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 43 事件日历：按天计数，点某天看当天事件 */
export default function CalendarPage() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [day, setDay] = useState(today());
  const { openFriend, openWorld } = useDrawer();

  const { data } = useQuery({
    queryKey: ['calendar', month],
    queryFn: () => api(`calendar?month=${month}`),
  });

  const since = `${day}T00:00:00+08:00`;
  const until = new Date(new Date(`${day}T00:00:00+08:00`).getTime() + 86400_000).toISOString();
  const { data: events } = useQuery({
    queryKey: ['calendar-day', day],
    queryFn: () => api(`events?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&limit=200`),
  });

  const meta = monthMeta(month);
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));
  const max = Math.max(1, data?.max ?? 1);
  const cells = [...new Array(meta.weekday).fill(null)];
  for (let i = 1; i <= meta.days; i++) {
    cells.push(`${month}-${String(i).padStart(2, '0')}`);
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="chip" onClick={() => setMonth(shiftMonth(month, -1))}>‹ 上月</button>
        <span className="text-[14px] tabular-nums">{month}</span>
        <button className="chip" onClick={() => setMonth(shiftMonth(month, 1))}>下月 ›</button>
        <button className="chip" onClick={() => { setMonth(today().slice(0, 7)); setDay(today()); }}>回到今天</button>
        <span className="chip sm:ml-auto">本月 {data?.total ?? 0} 条事件</span>
      </div>

      <div className="card p-2">
        <div className="grid grid-cols-7 gap-1 pb-1">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <div key={w} className="label-xs text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />;
            const d = byDate.get(date);
            const n = d?.n ?? 0;
            const isToday = date === today();
            const active = date === day;
            return (
              <button
                key={date}
                onClick={() => setDay(date)}
                className="rounded-lg border p-1.5 text-left transition-colors"
                style={{
                  minHeight: 46,
                  borderColor: active ? 'var(--stroke-strong)' : 'var(--stroke-subtle)',
                  background: n ? `color-mix(in srgb, var(--status-joinme) ${Math.min(60, 10 + (n / max) * 50)}%, var(--surface-panel))` : 'var(--surface-panel)',
                  outline: isToday ? '1px solid var(--stroke-strong)' : 'none',
                }}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[12px] tabular-nums">{Number(date.slice(-2))}</span>
                  {n ? <span className="text-[11px] tabular-nums text-fg3">{n}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="label-xs mt-5 mb-2">{day} 的事件</div>
      {(events?.events ?? []).length === 0 ? (
        <div className="card px-3 py-4 text-[12px] text-fg3">这一天没有事件记录。</div>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'var(--stroke-subtle)' }}>
          {(events?.events ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="tabular-nums text-[11px] text-fg3">{fmtTime(e.at)}</span>
                <span className="chip" style={{ height: 20, padding: '0 .4rem', fontSize: 10 }}>{KIND[e.kind] ?? e.kind}</span>
                <button className="min-w-0 truncate text-left text-[12px] hover:underline" onClick={() => e.user_id && openFriend(e.user_id)}>
                  {e.display_name ?? e.user_id ?? '—'}
                </button>
                {e.world_id ? (
                  <button className="min-w-0 truncate text-left text-[12px] text-fg2 hover:underline" onClick={() => openWorld(e.world_id)}>
                    {e.world_name ?? e.world_id}
                  </button>
                ) : (
                  <span className="truncate text-[12px] text-fg3">{e.location ?? '—'}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
