export default function StatusBar({ status }) {
  const c = status?.collector;
  const online = !!c?.connected;
  const n = status?.friends;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <span className="chip">
        <span className="size-1.5 rounded-full" style={{ background: online ? 'var(--status-online)' : 'var(--status-busy)' }} />
        {online ? 'pipeline 已连接' : 'pipeline 断开'}
      </span>
      {n && (
        <span className="chip">
          在线 <b className="font-medium text-fg">{n.online}</b>
          <span className="text-fg3">/ {n.total}</span>
        </span>
      )}
      {c?.msg_count ? <span className="chip hidden sm:inline-flex">事件 {c.msg_count}</span> : null}
    </div>
  );
}
