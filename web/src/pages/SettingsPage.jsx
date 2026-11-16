import { useQuery } from '@tanstack/react-query';
import { api, BASE } from '../api.js';

/**
 * 36 采集健康：collector 活着没 / 24h 事件速率 / 最近错误。
 * 只读 /api/diagnostics，30 秒刷一次；数字来自库，不做本地推算。
 */
const fmtAt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

function Stat({ label, value, hint, muted }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="label-xs">{label}</div>
      <div className="mt-1 text-[14px] tabular-nums" style={{ color: muted ? 'var(--content-tertiary)' : undefined }}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-fg3">{hint}</div> : null}
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
  const stale = data?.stale;
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
        {stale ? (
          <span className="chip" data-active={stale.isStale ? 'false' : 'true'} title={`阈值 ${stale.thresholdMinutes} 分钟`}>
            <span
              className="size-1.5 rounded-full"
              style={{ background: stale.isStale ? 'var(--status-busy)' : 'var(--status-online)' }}
            />
            {stale.isStale ? `采集断连 ${stale.idleMinutes} 分钟` : '采集心跳正常'}
          </span>
        ) : null}
        {data?.db ? <span className="chip">库 {data.db}</span> : null}
      </div>

      {isError ? (
        <div className="card p-6 text-[12px] text-fg3">/api/diagnostics 请求失败：{error?.message}</div>
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
              ['断连阈值', stale ? `${stale.thresholdMinutes} 分钟` : '—'],
              ['告警记录（7 天）', stale ? `${stale.alerts?.count7d ?? 0} 次` : '—'],
              ['最近错误', c?.lastError ?? '无'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-[12px] text-fg3">{k}</span>
                <span className="min-w-0 truncate text-right text-[12px]" style={{ color: k === '最近错误' && c?.lastError ? 'var(--status-busy)' : undefined }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] leading-relaxed text-fg3">
            collector 常驻在 NAS，往 pipeline 推消息；这里只读，不会触发采集。
          </div>

          <div className="label-xs mt-5 mb-2">数据备份</div>
          <div className="card flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-[12px] text-fg3">
              好友 / 世界 / 事件 / 收藏 / 备注 / 标签，一次导出成 JSON。
            </span>
            <a className="chip" href={`${BASE}api/export/backup.json`} download>导出备份 JSON</a>
          </div>

          {/* 手机版预览：桌面宽屏下把界面装进 390×844 框里看，状态进地址栏 */}
          <div className="label-xs mt-5 mb-2">手机版预览</div>
          <div className="card flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-[12px] text-fg3">
              在桌面把界面套进 390×844 设备框，检查手机端间距与断行；关掉即恢复。
            </span>
            <button
              className="chip"
              onClick={() => {
                const on = new URLSearchParams(location.search).get('phone') === '1';
                const next = new URLSearchParams(location.search);
                if (on) next.delete('phone');
                else next.set('phone', '1');
                localStorage.setItem('vrc-phone-preview', on ? '0' : '1');
                location.search = next.toString();
              }}
            >
              {new URLSearchParams(location.search).get('phone') === '1' ? '退出手机预览' : '开启手机预览'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
