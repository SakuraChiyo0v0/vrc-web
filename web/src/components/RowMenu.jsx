import { useEffect, useRef, useState } from 'react';
import { send } from '../api.js';

/**
 * 97 条目右键菜单（真机 VRCX-0：右键行弹出「复制名字 / 打开资料 / 加收藏」）
 *
 *   const menu = useRowMenu();
 *   <tr onContextMenu={(e) => menu.open(e, friendItems({ id, name, openFriend, say }))}>
 *   <RowMenu menu={menu.menu} onClose={menu.close} />
 */
export function useRowMenu() {
  const [menu, setMenu] = useState(null);
  const open = (e, items) => {
    e.preventDefault();
    if (!items?.length) return;
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  const close = () => setMenu(null);
  return { menu, open, close };
}

/** 好友/玩家行通用菜单项；say = (msg) => void 用页面上的轻提示 */
export function friendItems({ id, name, openFriend, say }) {
  const items = [];
  if (name) {
    items.push({
      act: 'copy',
      glyph: '⧉',
      label: '复制名字',
      run: async () => {
        try {
          await navigator.clipboard.writeText(name);
          say?.(`已复制 ${name}`);
        } catch {
          say?.('复制失败（浏览器不允许剪贴板）');
        }
      },
    });
  }
  if (id) {
    items.push({ act: 'profile', glyph: '↗', label: '打开资料', run: () => openFriend?.(id) });
    items.push({
      act: 'favorite',
      glyph: '★',
      label: '加收藏',
      run: async () => {
        try {
          await send('favorites', 'POST', { kind: 'friend', targetId: id });
          say?.(`已收藏 ${name ?? id}`);
        } catch (e) {
          say?.(e.message);
        }
      },
    });
  }
  return items;
}

export default function RowMenu({ menu, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const W = 168;
  const H = menu.items.length * 28 + 8;
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - W - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - H - 8));

  return (
    <div ref={ref} className="rowmenu" data-rowmenu="1" role="menu" style={{ left: x, top: y, width: W }}>
      {menu.items.map((it) => (
        <button
          key={it.act}
          role="menuitem"
          className="rowmenu-item"
          data-act={it.act}
          onClick={() => {
            onClose();
            it.run?.();
          }}
        >
          <span className="rowmenu-glyph">{it.glyph}</span>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** 操作回执：页面底部一行「已复制 xxx」，1.8s 自动消失 */
export function useHint() {
  const [hint, setHint] = useState('');
  const timer = useRef(null);
  const say = (msg) => {
    setHint(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(''), 1800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { hint, say };
}

export function Hint({ text }) {
  if (!text) return null;
  return (
    <div className="rowhint" data-hint="1" role="status">
      {text}
    </div>
  );
}
