import { SHORTCUT_GROUPS } from '../lib/shortcuts.js';

/**
 * 68 `?` 快捷键表：数字键按侧栏顺序跳页。
 * 108 面板内容全部来自 lib/shortcuts.js 的 SHORTCUT_GROUPS（纯数据，node 可测），
 * 按用途分组、每条列出全部按键；面板里不写没实现的键。
 */
export default function ShortcutHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[12vh]"
      style={{ background: 'rgba(0,0,0,.32)' }}
      onClick={onClose}
    >
      <div
        className="shortcut-panel h-fit max-h-[76vh] w-[420px] max-w-[92vw] overflow-auto rounded-[12px] border shadow-xl"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--stroke-subtle)' }}>
          <span className="text-[12px] font-medium">键盘快捷键</span>
          <button className="text-[11px] text-fg3 hover:underline" onClick={onClose}>Esc 关闭</button>
        </div>
        <div className="p-2">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.name} className="shortcut-group" data-shortcut-group={g.name}>
              <div className="label-xs px-2 pb-1 pt-2">
                {g.name}
                {g.hint ? <span className="ml-1 font-normal text-fg3">· {g.hint}</span> : null}
              </div>
              {g.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px]">
                  <span className="min-w-0 flex-1">{it.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {it.keys.map((k) => (
                      <kbd key={k} className="rounded border px-1.5 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
