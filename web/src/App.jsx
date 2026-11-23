import { Suspense, lazy, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import StatusBar from './components/StatusBar.jsx';
import PhoneFrame from './components/PhoneFrame.jsx';
import Skeleton from './components/Skeleton.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutHelp from './components/ShortcutHelp.jsx';
import { DrawerProvider } from './components/drawers.jsx';
import RosterPanel from './components/RosterPanel.jsx';
import ErrorBoundary, { OfflineBanner } from './components/ErrorBoundary.jsx';
import { resolveShortcut } from './lib/shortcuts.js';
import {
  IconSearch, IconBell, IconSparkle, IconMoon, IconSun, IconPin,
  IconSplit, IconCollapseRight, IconMinimize, IconMaximize, IconClose
} from './components/icons.jsx';

// 134 路由级懒加载：16 个页面各自成 chunk，首屏只载入当前页那一个。
// 手机上首屏 JS 少一大截（441 kB → 主包 + 单个页面块），换页时来回切热 chunk 不再重复下载。
const PAGES = {
  overview: lazy(() => import('./pages/OverviewPage.jsx')),
  search: lazy(() => import('./pages/SearchPage.jsx')),
  friends: lazy(() => import('./pages/FriendsPage.jsx')),
  feed: lazy(() => import('./pages/FeedPage.jsx')),
  notifications: lazy(() => import('./pages/NotificationsPage.jsx')),
  sessions: lazy(() => import('./pages/SessionsPage.jsx')),
  players: lazy(() => import('./pages/PlayersPage.jsx')),
  moderation: lazy(() => import('./pages/ModerationPage.jsx')),
  encounters: lazy(() => import('./pages/EncountersPage.jsx')),
  stats: lazy(() => import('./pages/StatsPage.jsx')),
  favorites: lazy(() => import('./pages/FavoritesPage.jsx')),
  insights: lazy(() => import('./pages/InsightsPage.jsx')),
  worlds: lazy(() => import('./pages/WorldsPage.jsx')),
  calendar: lazy(() => import('./pages/CalendarPage.jsx')),
  friendlist: lazy(() => import('./pages/FriendListPage.jsx')),
  friendlog: lazy(() => import('./pages/FriendLogPage.jsx')),
  gamelog: lazy(() => import('./pages/GameLogPage.jsx')),
  settings: lazy(() => import('./pages/SettingsPage.jsx'))
};

const TITLES = {
  overview: ['概览', '总时长、每日与活跃时段，三块榜单'],
  search: ['搜索', '好友 / 世界 / 玩家一次搜完，可深链分享'],
  friends: ['好友位置', '谁在线、在哪个世界'],
  feed: ['动态', '好友状态 / 位置 / 资料变更'],
  notifications: ['通知', '邀请 / 好友请求 / 群公告'],
  sessions: ['我的行程', '进出过的世界与停留时长'],
  players: ['房内玩家', '和我在同一个实例的好友'],
  moderation: ['玩家管理', '屏蔽 / 静音记录'],
  encounters: ['遇到过的玩家', '同房遇到过的人、共处次数排行'],
  stats: ['统计', '近 24 小时'],
  favorites: ['收藏', '世界 / 好友、分组与备注，固定的世界在侧栏'],
  insights: ['洞察', '常一起玩 / 渐行渐远 / 最常遇到的时段'],
  worlds: ['世界库', '去过的世界：搜索、按最近活跃或访问次数排序'],
  calendar: ['日历', '按天回看事件，点某天看当天'],
  friendlist: ['好友列表', '全量好友：信任等级 / 标签 / 收藏，最后在线'],
  friendlog: ['好友历史', '最近 24 小时全好友流水：上线 / 换世界 / 资料 / 状态'],
  gamelog: ['游戏日志', '自己的进出实例明细，可按世界过滤'],
  settings: ['设置', '采集器状态、事件速率、最近错误']
};

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('vrc-theme') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vrc-theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

/** 软键盘：iOS 弹出键盘时 layout viewport（100% / 100dvh）不变，只有 visualViewport 变矮，
 *  底部状态栏和浮层会被键盘吃掉又滚不出来。移动形态下把 --app-vh 跟着 visualViewport.height 走，
 *  外壳高度用 var(--app-vh)，键盘收起即恢复 dvh。桌面形态不介入（地址栏伸缩只差几十 px，不触发）。 */
function useSoftKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const mobile = window.matchMedia('(max-width:1023px), (max-height:500px)').matches;
      // 键盘至少吃掉 120px；地址栏/工具栏伸缩通常 <100px，不能当键盘把外壳压矮
      const keyboard = vv.height > 0 && vv.height < window.innerHeight - 120;
      if (mobile && keyboard) {
        root.style.setProperty('--app-vh', `${Math.round(vv.height)}px`);
        // iOS 聚焦靠下的输入框时还会把可视区整体上卷（visualViewport.offsetTop>0）：
        // 外壳按 offsetTop 下移，顶栏才不会被顶出屏外、底部按钮才落回可视区内。
        root.style.setProperty('--app-vv-top', `${Math.round(vv.offsetTop || 0)}px`);
        root.dataset.kb = '1';
      } else {
        root.style.removeProperty('--app-vh');
        root.style.removeProperty('--app-vv-top');
        delete root.dataset.kb;
      }
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--app-vh');
      root.style.removeProperty('--app-vv-top');
      delete root.dataset.kb;
    };
  }, []);
}

export default function App() {
  // 页面来自地址栏 #hash（可深链、可截图/验收直开某页），无 hash 时默认好友位置
  const readHash = () => {
    // 允许页面级筛选：#/friendlist?trust=4 —— 取 ? 之前的页面名
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').split('?')[0];
    return PAGES[h] ? h : null;
  };
  const [page, setPage] = useState(() => readHash() ?? 'friends');
  const [nav, setNav] = useState(false);
  // 188 真机 SidebarFooter 的「收起导航栏」：桌面折叠侧栏，状态记在 localStorage（下次进来保持）
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vrc-nav-collapsed') === '1');
  useEffect(() => {
    localStorage.setItem('vrc-nav-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  // 187 右栏默认展开（真机 1700 宽下内容面板内就有右栏）；窄屏(<1280)由 CSS 隐藏
  const [roster, setRoster] = useState(() => {
    const v = localStorage.getItem('vrc-roster-open');
    if (v === null) return typeof window !== 'undefined' ? window.innerWidth >= 1280 : false;
    return v === '1';
  });
  const [theme, toggleTheme] = useTheme();
  const Page = PAGES[page] ?? PAGES.friends;

  // hash ⇄ page 双向同步
  useEffect(() => {
    // 同页不覆盖 query（hashQuery 用它存筛选），换页才重写
    const cur = (window.location.hash ?? '').replace(/^#\/?/, '').split('?')[0];
    if (cur !== page) window.history.replaceState(null, '', `#/${page}`);
  }, [page]);
  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      if (h) setPage(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { localStorage.setItem('vrc-roster-open', roster ? '1' : '0'); }, [roster]);
  useSoftKeyboardViewport();
  // 状态必须自动刷新：否则采集器重连后页面还挂着「离线」，看着像故障
  const { data: status, isError: statusError } = useQuery({ queryKey: ['status'], queryFn: () => api('status'), refetchInterval: 15_000, refetchOnWindowFocus: true });

  // 68 ⌘/Ctrl+数字跳页、? 快捷键表（逻辑在 lib/shortcuts.js，有 node 单测）
  useEffect(() => {
    const onKey = (e) => {
      if (palette) return; // 搜索浮层自己处理按键
      // 抽屉只在移动形态存在：桌面形态下 nav 若还留着 true（旋转残留）不能让 Esc 去改它
      if (e.key === 'Escape' && nav && window.matchMedia('(max-width: 1023px), (max-height: 500px)').matches) { e.preventDefault(); setNav(false); return; }
      if (help && e.key === 'Escape') { e.preventDefault(); setHelp(false); return; }
      const hit = resolveShortcut(e);
      if (!hit) return;
      if (hit.type === 'navigate') { e.preventDefault(); setPage(hit.page); setHelp(false); setNav(false); }
      else if (hit.type === 'help') { e.preventDefault(); setHelp((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette, help, nav]);

  // ?phone=1：整页换成 390×844 的同源 iframe（媒体查询才真的按手机宽度算）
  if (new URLSearchParams(location.search).get('phone') === '1') return <PhoneFrame />;

  return (
    <DrawerProvider>
      {/* 184 外壳按真机量测（docs/ref/vrcx0-spec.json → chrome）：
          通栏顶栏 h39 / 侧栏 277 / 内容面板贴侧栏、右边距 11 / 底部状态栏 h35 */}
      <div id="vrc-shell" className="flex h-full flex-col" style={{ background: 'var(--surface-canvas)', height: 'var(--app-vh)' }}>
        <header
          id="vrc-topbar"
          className="vrc-topbar flex h-[39px] shrink-0 items-center border-b"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-shell)', paddingLeft: 'calc(14px + var(--safe-left, 0px))', paddingRight: 'calc(8px + var(--safe-right, 0px))' }}
        >
          {/* 顶栏是页面无关的自定义标题栏（spec.chrome.topbar / scripts/measure_ref_topbar.py
              量 16 张真机截图逐项一致）：品牌 + 帮助 / 快速搜索 + 6 图标 + 3 窗口控制。
              页面标题只在内容区，这里 md 以上只留 sr-only 供无障碍与 nav_coverage 读。 */}
          <button className="chip md:hidden" onClick={() => setNav(true)} aria-label="菜单">☰</button>
          {collapsed ? (
            <button
              className="chip hidden md:inline-flex"
              onClick={() => setCollapsed(false)}
              title="展开导航栏"
              aria-label="展开导航栏"
              data-testid="nav-expand"
            >
              ☰
            </button>
          ) : null}
          <span data-topbar="brand" className="hidden whitespace-nowrap text-[12px] font-medium md:inline-flex" style={{ letterSpacing: 0.85 }}>VRCX-0</span>
          <button
            data-topbar="help"
            className="ml-[25px] hidden rounded py-0.5 text-[12px] text-fg2 hover:bg-raised md:inline-flex"
            onClick={() => setHelp((v) => !v)}
            title="帮助（快捷键 ?）"
          >
            帮助
          </button>
          <h1 className="whitespace-nowrap text-[13px] font-medium md:sr-only">{TITLES[page]?.[0] ?? ''}</h1>

          <div className="ml-auto flex shrink-0 items-center">
            {/* 手机端没有键盘：桌面靠 Ctrl K 打开的快速搜索，移动端给一个看得见的入口 */}
            <button
              data-topbar="search-mobile"
              className="chip md:hidden"
              onClick={() => setPalette(true)}
              aria-label="快速搜索"
            >
              <IconSearch size={15} />
            </button>
            <button
              data-topbar="search"
              onClick={() => setPalette(true)}
              className="hidden h-6 items-center text-[12px] text-fg3 hover:text-fg md:flex"
              style={{ width: 225 }}
              title="快速搜索（Ctrl K）"
            >
              <IconSearch size={15} />
              <span className="truncate">快速搜索</span>
              {/* 真机 Ctrl K 宽 34：字号必须留在 11px 档（10/9.5px 会破 visual_parity 字号白名单），用负字距压到 34 */}
              <kbd className="ml-auto text-[11px] opacity-70" style={{ letterSpacing: -1 }}>Ctrl K</kbd>
            </button>
            <div data-topbar="actions" className="ml-[22px] hidden items-center md:flex" style={{ gap: 12 }}>
              <button className="tb-icon" onClick={() => setPage('notifications')} title="通知"><IconBell size={16} /></button>
              <button className="tb-icon" onClick={() => setPage('insights')} title="洞察"><IconSparkle size={16} /></button>
              <button className="tb-icon" onClick={toggleTheme} title={theme === 'light' ? '切到深色' : '切到浅色'}>
                {theme === 'light' ? <IconMoon size={15} /> : <IconSun size={15} />}
              </button>
              <button className="tb-icon" onClick={() => setPage('favorites')} title="收藏（固定的世界）"><IconPin size={16} /></button>
              <button
                className="tb-icon"
                data-active={roster ? 'true' : undefined}
                onClick={() => setRoster((v) => !v)}
                title="右栏好友面板"
              >
                <IconSplit size={15} />
              </button>
              <button className="tb-icon" onClick={() => setCollapsed(true)} title="收起导航栏"><IconCollapseRight size={15} /></button>
            </div>
            {/* 真机量的是字形：图标 glyph 间距 25（actions 末图 → 窗口控制首图），按钮内左右各余 4.5/6 已扣掉 */}
            <div data-topbar="window-controls" className="ml-[15px] hidden items-center md:flex" style={{ gap: 16 }}>
              <span className="tb-icon cursor-default text-fg3" aria-hidden="true" title="最小化（桌面壳）"><IconMinimize size={14} /></span>
              <span className="tb-icon cursor-default text-fg3" aria-hidden="true" title="最大化（桌面壳）"><IconMaximize size={14} /></span>
              <span className="tb-icon cursor-default text-fg3" aria-hidden="true" title="关闭（桌面壳）"><IconClose size={14} /></span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* 33 <768px：侧栏收成抽屉，顶栏汉堡开，选完页面自动关 */}
          {nav ? (
            <button
              className="fixed inset-0 z-40 cursor-default border-0 md:hidden"
              style={{ background: 'rgb(0 0 0 / 0.28)' }}
              aria-label="关闭菜单"
              onClick={() => setNav(false)}
            />
          ) : null}
          {collapsed ? null : (
            <Sidebar
              page={page}
              onNavigate={(p) => { setPage(p); setNav(false); }}
              me={status?.account}
              open={nav}
              onClose={() => setNav(false)}
              onCollapse={() => setCollapsed(true)}
            />
          )}

          <main className="flex min-w-0 flex-1 flex-col">
            {/* 65 主内容 workspace：1px ring + 顶部内高光，卡片不再裸贴页面 */}
            {/* 115 断网提示 + 页面级错误边界：换页自动重挂载，错误不串页 */}
            <OfflineBanner />
            {/* 187 真机内容面板 =「页面 + 右栏」同一个白底面板（分割线 x1323 在面板内部），
                所以右栏放进 .workspace 里，外壳 content.w 仍是 1398 */}
            <div className="workspace min-h-0 flex-1 overflow-hidden flex">
              <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                <ErrorBoundary key={page}>
                  <Suspense fallback={<div className="p-4"><Skeleton rows={6} cols={4} /></div>}>
                    <Page onNavigate={setPage} />
                  </Suspense>
                </ErrorBoundary>
              </div>
              {/* 好友页自身已是全量列表，不重复显示 */}
              {roster && page !== 'friends' ? <RosterPanel /> : null}
            </div>
          </main>
        </div>

        <StatusBar status={status} serverOk={!statusError} />
      </div>

      <CommandPalette
        open={palette}
        onOpen={() => setPalette(true)}
        onClose={() => setPalette(false)}
        onNavigate={setPage}
      />

      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
    </DrawerProvider>
  );
}
