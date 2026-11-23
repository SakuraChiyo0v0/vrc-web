import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';

/**
 * 81 游戏日志：按「日期 → 实例」分组，行是进出记录（结构逐条来自真机截图
 * docs/ref/vrcx0-gamelog.png / crop-gamelog-head.png）：
 *   工具栏：类型（访问级别）/ 搜索 / 日期
 *   日期头：2026年11月22日星期日
 *   实例摘要：世界名 · 公开　11月22日 23:43 - 11月23日 0:05 · 22分钟 · 25 人
 *   事件行（无表头行）：时间 · 方向 · 玩家/人数 · 动作 · 时长
 * 同一分钟同动作的多条合成一行（真机首行的「7 + 玩家离开」）。
 */

const ACCESS = [['', '全部类型'], ['public', '公开'], ['friends+', '好友+'], ['friends', '仅好友'], ['group', '群组公开']];
const MIN = 60_000;

const hm = (iso) =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false });

const mdhm = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false })}`;
};

/** 真机日期头：「2026年11月22日星期日」 */
const dayHead = (date) => {
  const d = new Date(`${date}T00:00:00+08:00`);
  const wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日${wd}`;
};

function dur(m) {
  const n = Math.round(Number(m ?? 0));
  if (!n) return '—';
  if (n < 60) return `${n}分钟`;
  if (n < 1440) return `${Math.floor(n / 60)}小时${n % 60 ? `${n % 60}分` : ''}`;
  return `${Math.floor(n / 1440)}天${Math.floor((n % 1440) / 60)}小时`;
}

/** 一次停留里把 join/leave 配对，得出每个离开事件「待了多久」 */
function withStays(events, visit) {
  const open = new Map();
  const out = [];
  const sorted = [...(events ?? [])].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const ev of sorted) {
    if (ev.kind === 'join') {
      const q = open.get(ev.name) ?? [];
      q.push(ev.at);
      open.set(ev.name, q);
    } else {
      const q = open.get(ev.name) ?? [];
      const since = q.shift();
      open.set(ev.name, q);
      const mins = since ? (new Date(ev.at) - new Date(since)) / MIN : null;
      out.push({ ...ev, stay: mins });
    }
  }
  // 仍在房里的加入事件：从加入到本次停留结束
  for (const ev of sorted.filter((e) => e.kind === 'join')) {
    const q = open.get(ev.name) ?? [];
    if (q.includes(ev.at) && visit?.end_at) {
      out.push({ ...ev, stay: (new Date(visit.end_at) - new Date(ev.at)) / MIN });
    } else {
      out.push({ ...ev, stay: null });
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** 同一分钟 + 同动作 + 都是「没人名的批量」才合并；有名字各行独立（真机可展开） */
function foldRows(rows) {
  const out = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === r.kind && prev.at.slice(0, 16) === r.at.slice(0, 16)) {
      prev.names.push(r.name);
      prev.stay = prev.stay ?? r.stay;
    } else {
      out.push({ ...r, names: [r.name] });
    }
  }
  return out;
}

export default function GameLogPage() {
  const [access, setAccess] = useState('');
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const { openWorld, openFriend } = useDrawer();

  const { data, isLoading } = useQuery({
    queryKey: ['game-log-days'],
    queryFn: () => api('game-log/days?days=180')
  });

  const days = data?.days ?? [];
  const needle = q.trim().toLowerCase();

  const shown = useMemo(() => {
    const list = date ? days.filter((d) => d.date === date) : days;
    return list
      .map((d) => {
        const worlds = (d.worlds ?? [])
          .filter((w) => !access || w.access === access)
          .map((w) => {
            const rows = w.visits.flatMap((v) => withStays(v.events, v));
            const filtered = needle
              ? rows.filter(
                  (r) =>
                    String(r.name ?? '').toLowerCase().includes(needle) ||
                    String(w.world_name ?? '').toLowerCase().includes(needle)
                )
              : rows;
            return { ...w, rows: foldRows(filtered) };
          })
          .filter((w) => !needle || w.rows.length);
        return { ...d, worlds, minutes: worlds.reduce((a, w) => a + w.minutes, 0) };
      })
      .filter((d) => d.worlds.length);
  }, [days, date, access, needle]);

  const totalRows = shown.reduce((a, d) => a + d.worlds.reduce((x, w) => x + w.rows.length, 0), 0);
  const totalMinutes = shown.reduce((a, d) => a + d.minutes, 0);
  const selStyle = { borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' };

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-lg border px-2 text-[12px]"
          value={access}
          onChange={(e) => setAccess(e.target.value)}
          style={selStyle}
          aria-label="类型"
        >
          {ACCESS.map(([v, label]) => (
            <option key={v || 'all'} value={v}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索"
          aria-label="搜索"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-52 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={date} onChange={(e) => setDate(e.target.value)} style={selStyle} aria-label="日期">
          <option value="">全部日期</option>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {d.date}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[12px] text-fg3" data-total={totalRows}>
          {shown.length} 天 · {totalRows} 条 · 合计 {dur(totalMinutes)}
        </span>
      </div>

      {isLoading ? <div className="text-[12px] text-fg3">加载中…</div> : null}

      {!isLoading && !shown.length ? (
        <Empty
          icon="clock"
          title={'还没有游戏日志'}
          hint={access || date || q ? '这个筛选下没有记录，换个类型或日期。' : '采集器记到自己的进出实例后会出现。'}
        />
      ) : null}

      {shown.map((d) => (
        <div key={d.date} className="mb-3">
          <div className="group-head gl-dayhead" data-date={d.date}>
            <span className="font-medium text-fg1">{dayHead(d.date)}</span>
          </div>
          <div className="card overflow-hidden">
            {d.worlds.map((w) => (
              <div key={`${d.date}/${w.world_id}`} data-instance={w.world_id}>
                {/* 实例摘要行：世界名 · 访问级别　起止 · 时长 · 人数 */}
                <div className="gl-inst flex flex-wrap items-center gap-2 px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    <button
                      className="truncate hover:underline"
                      onClick={() => w.world_id && openWorld(w.world_id)}
                      title={w.world_name ?? w.world_id}
                    >
                      {w.world_name ?? w.world_id ?? '未知世界'}
                    </button>
                    {w.access_label ? <span className="ml-1.5 text-[11px] text-fg3">· {w.access_label}</span> : null}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-fg3">
                    {w.visits.length
                      ? `${mdhm(w.visits[0].start_at)} - ${mdhm(w.visits[w.visits.length - 1].end_at)} · ${dur(w.minutes)} · ${Math.max(
                          ...w.visits.map((v) => v.player_count ?? 0)
                        )} 人`
                      : ''}
                  </span>
                </div>
                {/* 事件行：时间 · 方向 · 玩家/人数 · 动作 · 时长（无表头行，同真机） */}
                <div className="gl-rows">
                  {w.rows.map((r, i) => {
                    const isJoin = r.kind === 'join';
                    const multi = r.names.length > 1;
                    return (
                      <div
                        key={`${r.at}/${r.kind}/${r.name}/${i}`}
                        className="gl-row"
                        data-list-row="1"
                        data-kind={r.kind}
                      >
                        <span className="gl-c tabular-nums text-fg3" data-cell="时间">{hm(r.at)}</span>
                        <span className="gl-c gl-dir" data-cell="方向" title={isJoin ? '进入' : '离开'}>
                          {isJoin ? '→' : '←'}
                        </span>
                        <span className="gl-c min-w-0 truncate" data-cell="玩家/人数">
                          {multi ? (
                            <span className="tabular-nums text-fg2">×{r.names.length}</span>
                          ) : (
                            <button
                              className="truncate hover:underline"
                              onClick={() => r.user_id && openFriend(r.user_id)}
                              title={r.name}
                            >
                              {r.name}
                            </button>
                          )}
                        </span>
                        <span className="gl-c text-fg2" data-cell="动作">{isJoin ? '玩家加入' : '玩家离开'}</span>
                        <span className="gl-c tabular-nums text-fg3" data-cell="时长">{r.stay == null ? '' : dur(r.stay)}</span>
                      </div>
                    );
                  })}
                  {!w.rows.length ? <div className="px-2.5 py-2 text-[11px] text-fg3">这次停留没有同房玩家的进出记录</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
