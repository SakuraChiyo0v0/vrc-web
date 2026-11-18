import { useCallback, useEffect, useRef, useState } from 'react';

const EDITABLE = /^(input|textarea|select)$/i;

/**
 * 96 键盘上下选择（规格：VRCX-0 真机 —— 列表内方向键移动高亮，Enter 打开，Esc 关闭）
 *
 *   const nav = useListNav({ count: rows.length, onEnter: (i) => open(rows[i]), onEscape: close });
 *   行上： data-nav-idx={i} data-nav-active={nav.active === i}
 *
 * 不加 tabIndex：让整页都能用方向键，但输入框/文本域/下拉里不抢键。
 * count 变化时把越界的高亮收回到最后一行，Enter 永远对着当前渲染的行。
 */
export function useListNav({ count, onEnter, onEscape, disabled = false }) {
  const [active, setActive] = useState(-1);
  const activeRef = useRef(-1);
  const set = useCallback((i) => {
    activeRef.current = i;
    setActive(i);
  }, []);

  useEffect(() => {
    if (activeRef.current >= count) set(count - 1);
  }, [count, set]);

  /* 高亮行滚进可视区（键盘一路按到底不会跑出屏幕） */
  useEffect(() => {
    if (active < 0) return;
    document.querySelector(`[data-nav-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    if (disabled) return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (EDITABLE.test(t.tagName) || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!count) return;
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        set(Math.min(count - 1, Math.max(0, activeRef.current + step)));
      } else if (e.key === 'Enter' && activeRef.current >= 0) {
        e.preventDefault();
        onEnter?.(activeRef.current);
      } else if (e.key === 'Escape') {
        if (activeRef.current >= 0) {
          set(-1);
          e.preventDefault();
        }
        onEscape?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, disabled, onEnter, onEscape, set]);

  return { active, setActive: set };
}
