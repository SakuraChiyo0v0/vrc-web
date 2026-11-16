import { PAGE_ORDER, PAGE_LABEL } from '../lib/shortcuts.js';

/** 68 `?` 快捷键表：数字键按侧栏顺序跳页 */
export default function ShortcutHelp({ open, onClose }) {
  if (!open) return null;
  const digits = PAGE_ORDER.slice(0, 9);
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[16vh]"
      style={{ background: 'rgba(0,0,0,.32)' }}
      onClick={onClose}
    >
      <div
        className="h-fit w-[420px] max-w-[92vw] overflow-hidden rounded-[12px] border shadow-xl"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--stroke-subtle)' }}>
          <span className="text-[12px] font-medium">键盘快捷键</span>
          <button className="text-[11px] text-fg3 hover:underline" onClick={onClose}>Esc 关闭</button>
        </div>
        <div className="p-2">
          <div className="label-xs px-2 pb-1 pt-1">跳页（⌘/Ctrl + 数字，按侧栏顺序）</div>
          {digits.map((id, i) => (
            <div key={id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
              <span>{PAGE_LABEL[id] ?? id}</span>
              <kbd className="rounded border px-1.5 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>⌘/Ctrl {i + 1}</kbd>
            </div>
          ))}
          <div className="mt-1 border-t px-2 pb-1 pt-2" style={{ borderColor: 'var(--stroke-subtle)' }}>
            <div className="flex items-center justify-between py-1 text-[12px]">
              <span>全局搜索</span>
              <kbd className="rounded border px-1.5 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>⌘/Ctrl K</kbd>
            </div>
            <div className="flex items-center justify-between py-1 text-[12px]">
              <span>搜索框粘贴 <code className="text-[11px]">usr_</code> / <code className="text-[11px]">wrld_</code> 直达</span>
              <span className="text-[11px] text-fg3">Enter</span>
            </div>
            <div className="flex items-center justify-between py-1 text-[12px]">
              <span>关闭浮层 / 抽屉</span>
              <kbd className="rounded border px-1.5 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>Esc</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
