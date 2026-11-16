import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import StatusBar from './components/StatusBar.jsx';
import PhoneFrame from './components/PhoneFrame.jsx';
import FeedPage from './pages/FeedPage.jsx';
import FriendsPage from './pages/FriendsPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import SessionsPage from './pages/SessionsPage.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import WorldsPage from './pages/WorldsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import FriendListPage from './pages/FriendListPage.jsx';
import FriendLogPage from './pages/FriendLogPage.jsx';
import GameLogPage from './pages/GameLogPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ShortcutHelp from './components/ShortcutHelp.jsx';
import { DrawerProvider } from './components/drawers.jsx';
import RosterPanel from './components/RosterPanel.jsx';
import { resolveShortcut } from './lib/shortcuts.js';

const PAGES = {
  overview: OverviewPage,
  friends: FriendsPage,
  feed: FeedPage,
  notifications: NotificationsPage,
  sessions: SessionsPage,
  players: PlayersPage,
  stats: StatsPage,
  favorites: FavoritesPage,
  insights: InsightsPage,
  worlds: WorldsPage,
  calendar: CalendarPage,
  friendlist: FriendListPage,
  friendlog: FriendLogPage,
  gamelog: GameLogPage,
  settings: SettingsPage
};

const TITLES = {
  overview: ['概览', '总时长、每日与活跃时段，三块榜单'],
  friends: ['好友位置', '谁在线、在哪个世界'],
  feed: ['动态', '好友状态 / 位置 / 资料变更'],
  notifications: ['通知', '邀请 / 好友请求 / 群公告'],
  sessions: ['我的行程', '进出过的世界与停留时长'],
  players: ['玩家', '同房遇到过的人'],
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

export default function App() {
  // 页面来自地址栏 #hash（可深链、可截图/验收直开某页），无 hash 时默认好友位置
  const readHash = () => {
    // 允许页面级筛选：#/friendlist?trust=4 —— 取 ? 之前的页面名
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').split('?')[0];
    return PAGES[h] ? h : null;
  };
  const [page, setPage] = useState(() => readHash() ?? 'friends');
  const [nav, setNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const Page = PAGES[page] ?? FriendsPage;

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
  // 状态必须自动刷新：否则采集器重连后页面还挂着「离线」，看着像故障
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('status'), refetchInterval: 15_000, refetchOnWindowFocus: true });

  // 68 ⌘/Ctrl+数字跳页、? 快捷键表（逻辑在 lib/shortcuts.js，有 node 单测）
  useEffect(() => {
    const onKey = (e) => {
      if (palette) return; // 搜索浮层自己处理按键
      if (help && e.key === 'Escape') { e.preventDefault(); setHelp(false); return; }
      const hit = resolveShortcut(e);
      if (!hit) return;
      if (hit.type === 'navigate') { e.preventDefault(); setPage(hit.page); setHelp(false); setNav(false); }
      else if (hit.type === 'help') { e.preventDefault(); setHelp((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette, help]);

  // ?phone=1：整页换成 390×844 的同源 iframe（媒体查询才真的按手机宽度算）
  if (new URLSearchParams(location.search).get('phone') === '1') return <PhoneFrame />;

  return (
    <DrawerProvider>
      <div className="flex h-full" style={{ background: 'var(--surface-canvas)' }}>
        {/* 33 <768px：侧栏收成抽屉，页头汉堡开，选完页面自动关 */}
        {nav ? (
          <button
            className="fixed inset-0 z-40 cursor-default border-0 md:hidden"
            style={{ background: 'rgb(0 0 0 / 0.28)' }}
            aria-label="关闭菜单"
            onClick={() => setNav(false)}
          />
        ) : null}
        <Sidebar
          page={page}
          onNavigate={(p) => { setPage(p); setNav(false); }}
          me={status?.account}
          open={nav}
          onClose={() => setNav(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5"
            style={{ borderColor: 'var(--stroke-subtle)' }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <button className="chip md:hidden" onClick={() => setNav(true)} aria-label="菜单">☰</button>
              <div className="flex items-center gap-2">
                <h1 className="whitespace-nowrap text-[14px] font-medium leading-tight">{TITLES[page]?.[0] ?? ''}</h1>
              </div>
              <p className="hidden truncate text-[11px] text-fg3 sm:block">{TITLES[page]?.[1] ?? ''}</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <button onClick={() => setPalette(true)} className="chip" title="全局搜索（⌘K）">
                <span className="opacity-60">⌕</span><span className="hidden sm:inline"> 搜索</span>
                <kbd className="ml-1 hidden text-[11px] opacity-50 sm:inline">⌘K</kbd>
              </button>
              <button onClick={() => setHelp(true)} className="chip" title="快捷键（?）">
                <span className="opacity-60">?</span>
              </button>
              <StatusBar status={status} />
              <button onClick={toggleTheme} className="chip" title="切换主题">
                {theme === 'light' ? '◐' : '☀'}
              </button>
            </div>
          </header>

          {/* 65 主内容 workspace：1px ring + 顶部内高光，卡片不再裸贴页面 */}
          <div className="workspace min-h-0 flex-1 overflow-auto">
            <Page onNavigate={setPage} />
          </div>
        </main>

        {/* 76 右栏常驻好友面板：好友页自身已经是全量列表，不重复显示 */}
        {page !== 'friends' ? <RosterPanel /> : null}
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
