import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

/**
 * 81 游戏日志：按「日期 → 世界」分组（规格取自 VRCX-0 真机截图）。
 *   顶部：类型筛选（访问级别）+ 日期选择
 *   日期头：当天总时长 / 世界数 / 次数
 *   世界行：世界名 · 区域 · 访问级别 · 累计时长 · 次数，点开展开每次停留（起止 / 时长 / 人数 / 玩家明细）
 * 数据走 /api/game-log/days（服务端已按 +08 切日聚合）。
 */

const ACCESS = [['', '全部类型'], ['public', '公开'], ['friends+', '好友+'], ['friends', '仅好友'], ['group', '群组公开']];

const hm = (iso) =>
  new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

const md = (date) => {
  const [y, m, d] = String(date).split('-');
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00+08:00`).getDay()];
  return `${Number(m)}月${Number(d)}日 ${wd}${String(y) !== String(new Date().getFullYear()) ? ` ${y}` : ''}`;
};

function dur(m) {
  const n = Number(m ?? 0);
  if (n < 60) return `${n}分钟`;
  if (n < 1440) return `${Math.floor(n / 60)}小时${n % 60 ? `${n % 60}分` : ''}`;
  return `${Math.floor(n / 1440)}天${Math.floor((n % 1440) / 60)}小时`;
}

export default function GameLogPage() {
  const [access, setAccess] = useState('');
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const { openWorld } = useDrawer();

  const { data, isLoading } = useQuery({
    queryKey: ['game-log-days'],
    queryFn: () => api('game-log/days?days=180')
  });

  const days = data?.days ?? [];
  const shown = useMemo(() => {
    const list = date ? days.filter((d) => d.date === date) : days;
    return list
      .map((d) => {
        const worlds = (d.worlds ?? []).filter((w) => !access || w.access === access);
        return { ...d, worlds, minutes: worlds.reduce((a, w) => a + w.minutes, 0), visits: worlds.reduce((a, w) => a + w.visits.length, 0) };
      })
      .filter((d) => d.worlds.length);
  }, [days, date, access]);

  const totalMinutes = shown.reduce((a, d) => a + d.minutes, 0);
  const totalVisits = shown.reduce((a, d) => a + d.visits, 0);

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selStyle = { borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' };

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={access} onChange={(e) => setAccess(e.target.value)} style={selStyle}>
          {ACCESS.map(([v, label]) => (
            <option key={v || 'all'} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={date} onChange={(e) => setDate(e.target.value)} style={selStyle}>
          <option value="">全部日期</option>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {md(d.date)} · {dur(d.minutes)}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-fg3">
          {shown.length} 天 · {totalVisits} 次进场 · 合计 {dur(totalMinutes)}
        </span>
      </div>

      {isLoading ? <div className="text-[12px] text-fg3">加载中…</div> : null}

      {!isLoading && !shown.length ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">还没有游戏日志</div>
          <div className="mt-1 text-[12px] text-fg3">
            {access || date ? '这个筛选下没有记录，换个类型或日期。' : '采集器记到自己的进出实例后会出现。'}
          </div>
        </div>
      ) : null}

      {shown.map((d) => (
        <div key={d.date} className="mb-3">
          <div className="group-head" style={{ height: 28 }}>
            <span className="font-medium text-fg1">{md(d.date)}</span>
            <span className="text-fg3">·</span>
            <span className="text-fg3">{dur(d.minutes)}</span>
            <span className="text-fg3">·</span>
            <span className="text-fg3">
              {d.worlds.length} 个世界 · {d.visits} 次
            </span>
          </div>
          <div className="card overflow-hidden">
            {d.worlds.map((w) => {
              const key = `${d.date}/${w.world_id}`;
              const isOpen = open.has(key);
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--stroke-subtle)' }}>
                  <button
                    className="flex w-full items-center gap-2 px-2.5 text-left"
                    style={{ height: 36, background: 'transparent' }}
                    data-open={isOpen}
                    onClick={() => toggle(key)}
                  >
                    <span className="w-3 shrink-0 text-[11px] text-fg3">{isOpen ? '▾' : '▸'}</span>
                    {w.region ? <span className="reg">{String(w.region).toUpperCase()}</span> : null}
                    <span
                      className="min-w-0 flex-1 truncate hover:underline"
                      onClick={(e) => {
                        if (w.world_id) {
                          e.stopPropagation();
                          openWorld(w.world_id);
                        }
                      }}
                    >
                      {w.world_name ?? w.world_id ?? '未知世界'}
                    </span>
                    <span className="shrink-0 text-[11px] text-fg3">{w.access_label ?? ''}</span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-fg3">{w.visits.length} 次</span>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums">{dur(w.minutes)}</span>
                  </button>

                  {isOpen ? (
                    <div className="px-2.5 pb-2">
                      {w.visits.map((v, i) => (
                        <div key={`${key}/${i}`} className="mb-1 rounded-lg px-2 py-1.5" style={{ background: 'var(--surface-raised)' }}>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="tabular-nums">
                              {hm(v.start_at)} – {hm(v.end_at)}
                            </span>
                            <span className="text-fg3">·</span>
                            <span className="tabular-nums">{dur(v.minutes)}</span>
                            <span className="text-fg3">·</span>
                            <span className="text-fg3">{v.player_count} 人同房</span>
                            {v.access_label ? <span className="text-[11px] text-fg3">· {v.access_label}</span> : null}
                          </div>
                          {v.players?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {v.players.map((p, j) => (
                                <span
                                  key={`${p.user_id ?? p.name}-${j}`}
                                  className="chip"
                                  style={{ height: 20, fontSize: 11 }}
                                  title={`${hm(p.at)} 加入`}
                                >
                                  {p.name}
                                  <span className="text-fg3 tabular-nums">{hm(p.at)}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-[11px] text-fg3">没有同房玩家明细</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
