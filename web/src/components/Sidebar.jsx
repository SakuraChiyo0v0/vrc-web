import { useEffect, useRef, useState } from 'react';

/**
 * 185 侧栏导航按 VRCX-0 真机结构：单列 SidebarMenu（无分组标题）+ 两个折叠夹（收藏 / 社交），
 * 密度来自 docs/ref/nav-measure.json：顶层行距 40、二级行距 35、二级左移 27。
 * 真机默认两夹都是展开的（截图里 sub 行可见），这里也默认展开。
 */
const NAV = [
  { id: 'overview', label: '概览', icon: '◈' },
  { id: 'feed', label: '动态', icon: '≡' },
  { id: 'friends', label: '好友位置', icon: '◉' },
  { id: 'gamelog', label: '游戏日志', icon: '⏱' },
  { id: 'sessions', label: '我的行程', icon: '◇' },
  { id: 'players', label: '房内玩家', icon: '☺' },
  { id: 'search', label: '搜索', icon: '⌕' },
  {
    id: 'fav',
    label: '收藏',
    icon: '★',
    children: [
      { id: 'favorites', label: '收藏', icon: '★' },
      { id: 'worlds', label: '世界库', icon: '▢' },
      { id: 'calendar', label: '日历', icon: '▦' }
    ]
  },
  {
    id: 'social',
    label: '社交',
    icon: '☷',
    children: [
      { id: 'friendlist', label: '好友列表', icon: '☷' },
      { id: 'friendlog', label: '好友历史', icon: '↺' },
      { id: 'moderation', label: '玩家管理', icon: '▥' },
      { id: 'encounters', label: '遇到过的玩家', icon: '⧉' }
    ]
  },
  { id: 'notifications', label: '通知', icon: '!' },
  { id: 'stats', label: '统计', icon: '▤' },
  { id: 'insights', label: '洞察', icon: '✧' }
];

function NavItem({ item, page, onNavigate, depth = 0 }) {
  return (
    <button
      onClick={() => onNavigate(item.id)}
      data-active={page === item.id}
      data-nav-kind={depth ? 'sub' : 'top'}
      data-nav-id={item.id}
      className="nav-item w-full text-left"
    >
      <span className="w-3.5 text-center text-[11px] opacity-60">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}

/** 折叠夹：行本身是顶层密度，展开后子项按二级密度排在左侧竖线里 */
function NavFolder({ item, page, onNavigate }) {
  const [open, setOpen] = useState(true);
  const childActive = item.children.some((c) => c.id === page);
  return (
    <div data-nav-folder={item.id}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-nav-kind="folder"
        data-active={childActive && !open}
        aria-expanded={open}
        className="nav-item w-full text-left"
      >
        <span className="w-3.5 text-center text-[11px] opacity-60">{item.icon}</span>
        <span className="truncate">{item.label}</span>
        <span className="nav-chevron ml-auto" data-open={open ? 'true' : 'false'}>›</span>
      </button>
      {open ? (
        <div className="nav-sub" data-nav-sub={item.id}>
          {item.children.map((c) => (
            <NavItem key={c.id} item={c} page={page} onNavigate={onNavigate} depth={1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 移动形态判据与 styles.css 的 @media 一致：窄 ≤1023 或矮 ≤500。侧栏在这些形态下才是抽屉。 */
const MOBILE_FORM = '(max-width: 1023px), (max-height: 500px)';

function useIsMobileForm() {
  const [matches, setMatches] = useState(() => window.matchMedia(MOBILE_FORM).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_FORM);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return matches;
}

export default function Sidebar({ page, onNavigate, me, open = false, onClose, onCollapse }) {
  const ref = useRef(null);
  const mobile = useIsMobileForm();
  // 旋转/拉宽到桌面形态后抽屉概念消失：清掉 open（否则 data-open 残留、Esc 还能「关」一次桌面侧栏），
  // 同时卸载下面的焦点陷阱。onClose 每帧都是新箭头函数，用 ref 拿最新的，避免 effect 反复触发。
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (open && !mobile) closeRef.current?.();
  }, [open, mobile]);

  // 44 抽屉打开时焦点进侧栏并困在里面（手机没有 Tab 键，但外接键盘/读屏要能走完菜单且不漏到背后的内容区）；
  // 关闭时焦点还给 ☰。Esc 关闭在 App 的全局 keydown 里（它管 sidebar 的开关状态）。
  useEffect(() => {
    if (!open || !mobile) return;
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement;
    const items = () => [...el.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')]
      .filter((n) => n.getBoundingClientRect().width > 0 && !n.hasAttribute('disabled'));
    items()[0]?.focus();
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const next = e.shiftKey
        ? (i <= 0 ? list[list.length - 1] : list[i - 1])
        : (i < 0 || i === list.length - 1 ? list[0] : list[i + 1]);
      e.preventDefault();
      next?.focus();
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (prev?.isConnected && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, mobile]);

  return (
    <aside
      ref={ref}
      className="vrc-sidebar flex w-[214px] shrink-0 flex-col border-r md:w-[277px]"
      data-open={open ? 'true' : 'false'}
      style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)' }}
    >
      {/* 184 品牌与账号已上移到通栏顶栏（真机侧栏从顶栏下方开始，头部只有导航） */}
      <div className="flex h-9 items-center justify-between px-3 md:hidden">
        <span className="truncate text-[12px] font-medium">{me?.display_name ?? 'VRC'}</span>
        <button className="vrc-sidebar-close chip" onClick={onClose} aria-label="关闭菜单">✕</button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2.5 pt-2">
        {NAV.map((item) =>
          item.children ? (
            <NavFolder key={item.id} item={item} page={page} onNavigate={onNavigate} />
          ) : (
            <NavItem key={item.id} item={item} page={page} onNavigate={onNavigate} />
          )
        )}
      </nav>

      {/* 185/188 SidebarFooter：真机只有两项（设置 / 收起导航栏），上方无分割线、没有说明文字块。
          量测见 docs/ref/footer-measure.json：footer pitch 39。 */}
      <div className="px-2.5 pb-2" data-nav-footer="1">
        <NavItem item={{ id: 'settings', label: '设置', icon: '⚙' }} page={page} onNavigate={onNavigate} />
        <button
          onClick={() => onCollapse?.()}
          data-nav-kind="footer"
          data-testid="nav-collapse"
          className="nav-item w-full text-left"
          title="收起导航栏"
        >
          <span className="w-3.5 text-center text-[11px] opacity-60">⇤</span>
          <span className="truncate">收起导航栏</span>
        </button>
      </div>
    </aside>
  );
}
