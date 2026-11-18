import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import Empty from '../components/Empty.jsx';

export default function SessionsPage() {
  const { data } = useQuery({ queryKey: ['my-sessions'], queryFn: () => api('my-sessions') });
  const rows = data?.sessions ?? [];
  const total = rows.reduce((a, s) => a + (s.minutes ?? 0), 0);

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        <span className="chip">共 {rows.length} 段</span>
        <span className="chip">{total >= 60 ? `合计 ${Math.floor(total / 60)} 小时 ${total % 60} 分` : `合计 ${total} 分钟`}</span>
      </div>
      {rows.length === 0 ? (
        <Empty icon="clock" title={'还没有行程记录'} hint={'下次进 VRChat 换世界时会自动记录。'} />
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
                  <td className="text-[12px] text-fg3">{new Date(s.start_at).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="text-fg2">{s.minutes != null ? `${s.minutes} 分钟` : '进行中'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="label-xs mt-5 mb-2">时间线</div>
      {rows.length === 0 ? (
        <Empty icon="clock" title={'暂无时间线数据'} hint={'有行程记录后会在这里按时间展示。'} />
      ) : (
        <div className="card p-4">
          <div className="relative pl-5">
            <span
              className="absolute top-1 bottom-1 left-[5px] w-px"
              style={{ background: 'var(--stroke-default)' }}
            />
            {rows.map((s, i) => (
              <div key={i} className="relative py-2.5">
                <span
                  className="absolute top-[17px] -left-[19px] h-[9px] w-[9px] rounded-full"
                  style={{ background: s.minutes != null ? 'var(--stroke-strong)' : 'var(--status-joinme)', border: '2px solid var(--surface-panel)' }}
                />
                <div className="text-[12px]">{s.world ?? s.location}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-fg3">
                  <span>{new Date(s.start_at).toLocaleString('zh-CN', { hour12: false })} 进入</span>
                  <span>·</span>
                  <span>{s.minutes != null ? `停留 ${s.minutes} 分钟` : '进行中'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
