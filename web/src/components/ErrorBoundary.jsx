import { Component, useEffect, useState } from 'react';

/** 115 接口失败重试卡：标题 + 原因 + 重试按钮，不白屏 */
export function ErrorCard({ title = '接口没连上', error, onRetry, hint }) {
  return (
    <div className="card m-4 p-4" role="alert" data-error-card="1">
      <div className="flex items-start gap-3">
        <span className="text-[15px] leading-6" aria-hidden>⚠</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{title}</div>
          <div className="mt-0.5 break-words text-[12px] text-fg3">
            {hint ?? (error?.message ? String(error.message) : '请求失败，可能是采集器或后端暂时不可用。')}
          </div>
          {onRetry ? (
            <button className="chip mt-2" onClick={() => onRetry()}>重试</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 115 错误边界：渲染期异常兜底，给出重试而不是整页白屏 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[boundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorCard
        title="这个页面出错了"
        error={this.state.error}
        hint="界面渲染失败，数据没丢。点重试重新渲染；还不行就刷新页面。"
        onRetry={this.reset}
      />
    );
  }
}

/** 115 离线提示条：断网时置顶显示，恢复后自动消失 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="shrink-0 border-b px-3 py-1.5 text-[11px] sm:px-5"
      style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-raised)', color: 'var(--content-secondary)' }}
      role="status" data-offline="1">
      离线：显示的是缓存数据，恢复网络后自动刷新
    </div>
  );
}
