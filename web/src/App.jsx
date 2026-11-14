import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import StatusBar from './components/StatusBar.jsx';
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
import CommandPalette from './components/CommandPalette.jsx';
import { DrawerProvider } from './components/drawers.jsx';

const PAGES = {
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
  settings: SettingsPage
};

const TITLES = {
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
  const [page, setPage] = useState('friends');
  const [nav, setNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const Page = PAGES[page] ?? FriendsPage;
  // 状态必须自动刷新：否则采集器重连后页面还挂着「离线」，看着像故障
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('status'), refetchInterval: 15_000, refetchOnWindowFocus: true });

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
                <kbd className="ml-1 hidden text-[9.5px] opacity-50 sm:inline">⌘K</kbd>
              </button>
              <StatusBar status={status} />
              <button onClick={toggleTheme} className="chip" title="切换主题">
                {theme === 'light' ? '◐' : '☀'}
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-auto">
            <Page onNavigate={setPage} />
          </div>
        </main>
      </div>

      <CommandPalette
        open={palette}
        onOpen={() => setPalette(true)}
        onClose={() => setPalette(false)}
        onNavigate={setPage}
      />
    </DrawerProvider>
  );
}
