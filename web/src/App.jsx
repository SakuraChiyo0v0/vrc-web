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

const PAGES = {
  friends: FriendsPage,
  feed: FeedPage,
  notifications: NotificationsPage,
  sessions: SessionsPage,
  players: PlayersPage,
  stats: StatsPage
};

const TITLES = {
  friends: ['好友位置', '谁在线、在哪个世界'],
  feed: ['动态', '好友状态 / 位置 / 资料变更'],
  notifications: ['通知', '邀请 / 好友请求 / 群公告'],
  sessions: ['我的行程', '进出过的世界与停留时长'],
  players: ['玩家', '同房遇到过的人'],
  stats: ['统计', '近 24 小时']
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
  const [theme, toggleTheme] = useTheme();
  const Page = PAGES[page] ?? FriendsPage;
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('status') });

  return (
    <div className="flex h-full" style={{ background: 'var(--surface-canvas)' }}>
      <Sidebar page={page} onNavigate={setPage} me={status?.account} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5"
          style={{ borderColor: 'var(--stroke-subtle)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[14px] font-medium leading-tight">{TITLES[page]?.[0] ?? ''}</h1>
            </div>
            <p className="text-[11px] text-fg3">{TITLES[page]?.[1] ?? ''}</p>
          </div>

          <div className="flex items-center gap-2">
            <StatusBar status={status} />
            <button onClick={toggleTheme} className="chip" title="切换主题">
              {theme === 'light' ? '◐' : '☀'}
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <Page />
        </div>
      </main>
    </div>
  );
}
