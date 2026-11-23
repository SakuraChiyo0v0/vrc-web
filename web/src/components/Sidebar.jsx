import { useState } from 'react';

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

export default function Sidebar({ page, onNavigate, me, open = false, onClose, onCollapse }) {
  return (
    <aside
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
