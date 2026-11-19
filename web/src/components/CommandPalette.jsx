import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import { useDrawer } from './drawers.jsx';
import { parseVrcTarget } from '../lib/vrchatTarget.js';

/** ⌘K / Ctrl+K 全局搜索：好友、世界、玩家三类，键盘可选 */
export default function CommandPalette({ open, onClose, onOpen, onNavigate }) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const { openWorld, openFriend } = useDrawer();
  const setOpen = (v) => (v ? onOpen?.() : onClose?.());

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose?.(); else onOpen?.();
      } else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpen, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else { setQ(''); setCursor(0); }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api(`search?q=${encodeURIComponent(q)}`),
    enabled: open && q.trim().length > 0 && !parseVrcTarget(q)
  });

  // 69 粘贴 usr_/wrld_/链接：置顶「直接打开」，Enter 就进抽屉，不用等搜索
  const direct = useMemo(() => {
    const t = parseVrcTarget(q);
    if (!t) return null;
    return {
      key: `direct-${t.id}`,
      group: '直接打开',
      label: t.type === 'user' ? `好友 ${t.id}` : `世界 ${t.id}`,
      hint: '插件 ID / 链接',
      run: () => (t.type === 'user' ? openFriend(t.id) : openWorld(t.id))
    };
  }, [q, openFriend, openWorld]);

  const items = useMemo(() => [
    ...(direct ? [direct] : []),
    ...(data?.friends ?? []).map((f) => ({ key: `f-${f.user_id}`, group: '好友', label: f.display_name ?? f.user_id, hint: f.world_name ?? f.location ?? '', run: () => openFriend(f.user_id) })),
    ...(data?.worlds ?? []).map((w) => ({ key: `w-${w.id}`, group: '世界', label: w.name ?? w.id, hint: w.author_name ?? '', run: () => openWorld(w.id) })),
    ...(data?.players ?? []).map((p) => ({ key: `p-${p.user_id ?? p.name}`, group: '玩家', label: p.name, hint: `${p.meets} 次 · ${p.last_seen ? new Date(p.last_seen).toLocaleDateString('zh-CN') : ''}`, run: () => onNavigate?.('players') }))
  ], [direct, data, openFriend, openWorld, onNavigate]);

  useEffect(() => { setCursor(0); }, [q, items.length]);

  const choose = (it) => {
    if (!it) return;
    setOpen(false);
    it.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, Math.max(items.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[cursor]); }
  };

  if (!open) return null;

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center pt-[12vh]" style={{ background: 'rgba(0,0,0,.32)' }} onClick={() => setOpen(false)}>
      <div
        className="h-fit w-[560px] max-w-[92vw] overflow-hidden rounded-[12px] border shadow-xl"
        style={{ background: 'var(--surface-panel)', borderColor: 'var(--stroke-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜好友、世界、玩家… 也可粘贴 usr_ / wrld_ 链接直达"
          className="h-11 w-full border-b px-4 text-[14px] outline-none"
          style={{ background: 'transparent', borderColor: 'var(--stroke-subtle)', color: 'var(--content-primary)' }}
        />
        <div className="max-h-[52vh] overflow-auto p-1.5">
          {q.trim().length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-fg3">
              输入名字开始搜索 · ↑↓ 选择 · Enter 打开 · Esc 关闭
            </div>
          )}
          {q.trim().length > 0 && items.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-fg3">{isFetching ? '搜索中…' : '没找到匹配的好友 / 世界 / 玩家'}</div>
          )}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.key}>
                {head ? <div className="label-xs px-2 pb-1 pt-2">{head}</div> : null}
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(it)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left"
                  style={i === cursor ? { background: 'var(--state-selected-surface)' } : undefined}
                >
                  <span className="min-w-0 truncate text-[12px]">{it.label}</span>
                  <span className="shrink-0 text-[11px] text-fg3">{it.hint}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11px] text-fg3" style={{ borderColor: 'var(--stroke-subtle)' }}>
          <span>⌘K 打开 / 关闭</span>
          <span className="flex items-center gap-2">
            {q.trim() ? (
              <button
                className="chip"
                data-palette-all="1"
                onClick={() => { onClose?.(); location.hash = `#/search?q=${encodeURIComponent(q.trim())}`; }}
              >
                在搜索页查看全部 →
              </button>
            ) : null}
            <span>{items.length} 条结果</span>
          </span>
        </div>
      </div>
    </div>
  );
}
