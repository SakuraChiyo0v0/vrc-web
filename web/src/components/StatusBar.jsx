/**
 * 188 底部状态栏按真机结构（docs/ref/footer-measure.json）：
 * 通栏 h35、左对齐 4 个「圆点 + 文字」状态项 —— 服务器状态 / 实时连接 / VRChat / SteamVR，
 * 点径 8、项间距 23、首点距 inner 左缘 10；右侧不放东西（真机 right_aligned=false）。
 *
 * 每项的绿/灰只跟真实信号走，没有数据源的一律灰（不编状态）：
 *   服务器状态 = 本服务 /api/status 拿到数据；实时连接 = pipeline collector.connected；
 *   VRChat = 账号最近一次 API 成功 < 10 分钟；SteamVR = 采集侧未接入，恒灰。
 */
const FRESH_MS = 10 * 60_000;

export default function StatusBar({ status, serverOk = true }) {
  const c = status?.collector;
  const lastOk = status?.account?.last_ok_at ? Date.parse(status.account.last_ok_at) : NaN;
  const items = [
    { id: 'server', label: '服务器状态', ok: serverOk && Boolean(status), title: '本服务 API / 数据库' },
    { id: 'live', label: '实时连接', ok: Boolean(c?.connected), title: 'VRChat pipeline 采集连接' },
    {
      id: 'vrchat',
      label: 'VRChat',
      ok: Number.isFinite(lastOk) && Date.now() - lastOk < FRESH_MS,
      title: 'VRChat API 账号最近一次成功请求'
    },
    { id: 'steamvr', label: 'SteamVR', ok: false, title: '采集侧未接入 SteamVR 状态' }
  ];
  return (
    <footer
      id="vrc-statusbar"
      className="flex h-[35px] shrink-0 items-center gap-[23px] overflow-hidden border-t pl-[10px] pr-3 text-[11px]"
      style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)', color: 'var(--content-tertiary)' }}
      data-statusbar-items={items.length}
    >
      {items.map((it) => (
        <span key={it.id} className="flex shrink-0 items-center gap-[9px]" title={it.title} data-status-item={it.id} data-ok={it.ok ? 'true' : 'false'}>
          <span
            className="size-2 rounded-full"
            style={{ background: it.ok ? 'var(--status-online)' : 'var(--status-offline, #b5b5b5)' }}
          />
          <span className="truncate">{it.label}</span>
        </span>
      ))}
    </footer>
  );
}
