/**
 * 184 底部状态栏（真机 h35，通栏在窗口最下方）：pipeline 连接 / 在线人数 / 事件数 / 当前页。
 * 尺寸被 scripts/chrome_parity.mjs 当成断言对象，改高度前先改 spec.chrome。
 */
export default function StatusBar({ status, theme, page }) {
  const c = status?.collector;
  const online = !!c?.connected;
  const n = status?.friends;
  return (
    <footer
      id="vrc-statusbar"
      className="flex h-[35px] shrink-0 items-center gap-3 overflow-hidden border-t px-3 text-[11px]"
      style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)', color: 'var(--content-tertiary)' }}
    >
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: online ? 'var(--status-online)' : 'var(--status-busy)' }} />
        {online ? 'pipeline 已连接' : 'pipeline 重连中'}
      </span>
      {n && (
        <span className="flex shrink-0 items-center gap-1">
          在线 <b className="font-medium text-fg">{n.online}</b>
          <span>/ {n.total}</span>
        </span>
      )}
      {c?.msg_count ? <span className="hidden shrink-0 sm:inline">事件 {c.msg_count}</span> : null}
      <span className="ml-auto hidden truncate sm:inline">{page ? `#/${page}` : ''}</span>
      <span className="hidden shrink-0 sm:inline">{theme === 'light' ? '浅色' : '深色'}</span>
    </footer>
  );
}
