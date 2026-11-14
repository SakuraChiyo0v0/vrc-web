import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

/**
 * 36 采集健康：collector 活着没 / 24h 事件速率 / 最近错误。
 * 只读 /api/diagnostics，30 秒刷一次；数字来自库，不做本地推算。
 */
const fmtAt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

function Stat({ label, value, hint, muted }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="label-xs">{label}</div>
      <div className="mt-1 text-[15px] tabular-nums" style={{ color: muted ? 'var(--content-tertiary)' : undefined }}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10.5px] text-fg3">{hint}</div> : null}
    </div>
  );
}

export default function SettingsPage() {
  const { data, isError, error } = useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => api('diagnostics'),
    refetchInterval: 30_000,
  });

  const c = data?.collector;
  const rate = data?.rate24h;
  const online = c?.connected === true;

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip" data-active={online ? 'true' : 'false'}>
          <span
            className="size-1.5 rounded-full"
            style={{ background: online ? 'var(--status-online)' : 'var(--status-busy)' }}
          />
          {isError ? '读不到诊断接口' : online ? '采集器在线' : '采集器离线'}
        </span>
        {c?.idleMinutes != null ? <span className="chip">最后消息 {c.idleMinutes} 分钟前</span> : null}
        {data?.db ? <span className="chip">库 {data.db}</span> : null}
      </div>

      {isError ? (
        <div className="card p-6 text-[12.5px] text-fg3">/api/diagnostics 请求失败：{error?.message}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <Stat label="24 小时事件" value={rate?.events ?? '—'} hint={`均 ${rate?.perHour ?? '—'} 条/小时`} />
            <Stat label="进房事件" value={rate?.gameEvents ?? '—'} hint="需要 PC 端日志，可能为 0" muted={rate?.gameEvents === 0} />
            <Stat label="追踪好友" value={data?.friendsTracked ?? '—'} hint="friend 表行数" />
            <Stat label="追踪世界" value={data?.worldsTracked ?? '—'} hint="world 表行数" />
            <Stat label="累计消息" value={c?.msgCount ?? '—'} hint="collector 收到过的消息数" />
            <Stat label="图片缓存" value={data?.cache?.files ?? '—'} hint={data?.cache?.dir ?? ''} />
          </div>

          <div className="label-xs mt-5 mb-2">采集状态</div>
          <div className="card divide-y" style={{ borderColor: 'var(--stroke-subtle)' }}>
            {[
              ['连接', online ? '在线' : '离线'],
              ['最后消息', fmtAt(c?.lastMsgAt)],
              ['空闲', c?.idleMinutes != null ? `${c.idleMinutes} 分钟` : '—'],
              ['最近错误', c?.lastError ?? '无'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[11.5px] text-fg3">{k}</span>
                <span className="min-w-0 truncate text-right text-[12px]" style={{ color: k === '最近错误' && c?.lastError ? 'var(--status-busy)' : undefined }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[10.5px] leading-relaxed text-fg3">
            collector 常驻在 NAS，往 pipeline 推消息；这里只读，不会触发采集。
          </div>
        </>
      )}
    </div>
  );
}
