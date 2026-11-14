import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

export default function SessionsPage() {
  const { data } = useQuery({ queryKey: ['my-sessions'], queryFn: () => api('my-sessions') });
  const rows = data?.sessions ?? [];
  const total = rows.reduce((a, s) => a + (s.minutes ?? 0), 0);

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        <span className="chip">共 {rows.length} 段</span>
        <span className="chip">合计 {Math.round(total / 60)} 小时</span>
      </div>
      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-[13px]">还没有行程记录</div>
          <div className="mt-1 text-[11.5px] text-fg3">下次进 VRChat 换世界时会自动记录。</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>世界</th>
                <th style={{ width: 170 }}>进入</th>
                <th style={{ width: 110 }}>停留</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={i}>
                  <td>{s.world ?? s.location}</td>
                  <td className="text-[11.5px] text-fg3">{new Date(s.start_at).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="text-fg2">{s.minutes != null ? `${s.minutes} 分钟` : '进行中'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
