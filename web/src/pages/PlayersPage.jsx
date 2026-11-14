import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export default function PlayersPage() {
  const { data } = useQuery({ queryKey: ['players'], queryFn: () => api('players') });
  const rows = data?.players ?? [];
  return (
    <div className="p-4">
      <div className="mb-3 text-[11.5px] text-fg3">来自游戏内日志（PC 端 log-agent）。</div>
      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[13px]">还没有同房记录</div>
          <div className="mt-1 text-[11.5px] text-fg3">在 PC 上启动 log-agent 后才有数据。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>玩家</th>
                <th style={{ width: 90 }}>同房</th>
                <th style={{ width: 170 }}>最近一次</th>
                <th>当时的世界</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.user_id ?? p.name}>
                  <td>{p.name}</td>
                  <td className="tabular-nums text-fg2">{p.meets}</td>
                  <td className="text-[11.5px] text-fg3">{new Date(p.last_seen).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="text-fg2">{p.last_world ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
