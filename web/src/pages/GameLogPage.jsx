import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

// 采集器写的是 room_enter / room_join / room_leave，旧种子用 join / leave，两种都认
const KIND_LABEL = { join: '进入', leave: '离开', room_enter: '进入房间', room_join: '加入', room_leave: '离开' };

const fg = (iso) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

/** 74 游戏日志：自己的进出实例明细（game_event），按世界 / 类型过滤 */
export default function GameLogPage() {
  const [world, setWorld] = useState('');
  const [kind, setKind] = useState('');
  const { openWorld } = useDrawer();

  const params = new URLSearchParams({ limit: '300' });
  if (world) params.set('world', world);
  if (kind) params.set('kind', kind);
  const { data, isLoading } = useQuery({
    queryKey: ['game-log', world, kind],
    queryFn: () => api(`game-log?${params.toString()}`)
  });

  const items = data?.items ?? [];
  const joins = items.filter((i) => i.kind === 'join' || i.kind === 'room_enter' || i.kind === 'room_join').length;

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={world}
          onChange={(e) => setWorld(e.target.value)}
          placeholder="世界名或 wrld_ id"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-60 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <select className="h-8 rounded-lg border px-2 text-[12px]" value={kind} onChange={(e) => setKind(e.target.value)} style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' }}>
          <option value="">全部</option>
          <option value="room_enter">进入房间</option>
          <option value="room_join">加入</option>
          <option value="room_leave">离开</option>
        </select>
        <span className="text-[12px] text-fg3">{items.length} 条 · {data?.worlds ?? 0} 个世界 · 进入 {joins} 次</span>
      </div>

      {isLoading ? <div className="text-[12px] text-fg3">加载中…</div> : null}

      {!isLoading && items.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[14px]">还没有游戏日志</div>
          <div className="mt-1 text-[12px] text-fg3">采集器记到进出实例后会出现。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col p-1">
            {items.map((i) => (
              <div key={i.id} className="friend-row" onClick={() => i.world_id && openWorld(i.world_id)}>
                <span className="w-10 shrink-0 text-[11px] text-fg3">{KIND_LABEL[i.kind] ?? i.kind}</span>
                <span className="min-w-0 flex-1 truncate">{i.world_name ?? i.world_id ?? '未知世界'}</span>
                <span className="hidden min-w-0 max-w-[28%] truncate text-[11px] text-fg3 sm:block">{i.instance ?? ''}</span>
                <span className="shrink-0 text-[11px] text-fg3">
                  {i.players?.length ? `${i.players.length} 人同房` : ''}
                </span>
                <span className="w-32 shrink-0 text-right text-[11px] tabular-nums text-fg3">{fg(i.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
