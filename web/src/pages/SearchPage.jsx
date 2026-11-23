import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';

/**
 * 搜索页 = 真机「探索」：docs/ref/vrcx0-search.png
 * 主导航 tab 探索/玩家/世界/模型/群组 → 子 tab 热门/发现（右端刷新）
 * → 一张通栏 hero 卡 + 3 列卡片网格（真机量测见 vrcx0-spec.json → pages.search.structure）。
 * 数据只用本地库：世界来自 /api/worlds（到访次数/最近活跃），玩家来自 /api/players。
 * 模型 / 群组本地没有数据源，显空态，不编数字。
 */
const TABS = ['探索', '玩家', '世界', '模型', '群组'];
const SUBS = ['热门', '发现'];

function WorldCard({ w, onOpen }) {
  return (
    <div className="world-card" onClick={() => onOpen(w.id)} title={w.name} data-card="world">
      {w.thumbnail ? (
        <img className="thumb" src={imgUrl(w.thumbnail)} alt="" loading="lazy" />
      ) : (
        <div className="thumb thumb-empty">{(w.name ?? '?').slice(0, 1)}</div>
      )}
      <div className="wc-body">
        <div className="wc-name">{w.name}</div>
        <div className="wc-meta">
          <span>{w.author_name ?? '未知作者'} · {w.visits} 次到访</span>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [tab, setTab] = useState('探索');
  const [sub, setSub] = useState('热门');
  const { openWorld, openFriend } = useDrawer();

  const worlds = useQuery({
    queryKey: ['search-worlds', sub],
    queryFn: () => api(`worlds?sort=${sub === '热门' ? 'visits' : 'recent'}&limit=25`),
    enabled: tab === '探索' || tab === '世界',
  });
  const players = useQuery({
    queryKey: ['search-players'],
    queryFn: () => api('players'),
    enabled: tab === '玩家',
  });

  const list = worlds.data?.worlds ?? [];
  const hero = tab === '探索' ? list[0] : null;
  const grid = tab === '探索' ? list.slice(1) : list;

  return (
    <div className="p-4" data-page="search">
      {/* 主导航 tab（真机 5 个胶囊） */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="tablist" data-navtab-row>
        {TABS.map((t) => (
          <button key={t} role="tab" className="chip" data-navtab={t} data-active={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* 子 tab + 右端刷新 */}
      <div className="mb-3 flex items-center gap-1.5">
        {SUBS.map((s) => (
          <button key={s} className="chip" data-subtab={s} data-active={sub === s} onClick={() => setSub(s)}>
            {s}
          </button>
        ))}
        <button
          className="chip ml-auto"
          data-refresh="search"
          onClick={() => (tab === '玩家' ? players.refetch() : worlds.refetch())}
        >
          刷新
        </button>
      </div>

      {tab === '模型' || tab === '群组' ? (
        <Empty
          icon="star"
          title={tab === '模型' ? '还没有模型数据' : '还没有群组数据'}
          hint={tab === '模型' ? '本地库没有采集 VRChat 模型，先不画占位数字。' : '群组需要在线接口，采集器暂未收录。'}
        />
      ) : tab === '玩家' ? (
        (players.data?.players ?? []).length === 0 ? (
          <Empty icon="users" title="还没有同房遇到的玩家" hint="采集器记到进出房事件后，这里会按共处次数排出玩家。" />
        ) : (
          <div className="world-grid" data-grid="players">
            {(players.data?.players ?? []).map((p) => (
              <div
                key={p.user_id ?? p.name}
                className="card flex items-center gap-2.5 p-3"
                onClick={() => p.user_id && openFriend(p.user_id)}
              >
                <span className="avatar">
                  <span className="flex h-full w-full items-center justify-center text-[11px]" style={{ color: 'var(--content-tertiary)' }}>
                    {(p.name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">{p.name}</span>
                  <span className="block truncate text-[11px] text-fg3">{p.meets} 次 · {p.last_world ?? '—'}</span>
                </span>
              </div>
            ))}
          </div>
        )
      ) : worlds.isLoading ? (
        <div className="text-[12px] text-fg3">加载中…</div>
      ) : list.length === 0 ? (
        <Empty icon="star" title="还没有去过的世界" hint="采集器记录到进出世界后，这里会出现热门世界。" />
      ) : (
        <>
          {hero ? (
            <div
              className="world-card mb-2.5"
              data-hero="1"
              onClick={() => openWorld(hero.id)}
              title={hero.name}
              style={{ display: 'flex' }}
            >
              {hero.thumbnail ? (
                <img className="thumb res-hero-thumb" src={imgUrl(hero.thumbnail)} alt="" />
              ) : (
                <div className="thumb thumb-empty res-hero-thumb">{hero.name.slice(0, 1)}</div>
              )}
              <div className="wc-body flex flex-col justify-center">
                <div className="text-[14px] font-medium">{hero.name}</div>
                <div className="wc-meta"><span>{hero.author_name ?? '未知作者'} · {hero.visits} 次到访 · {hero.friends_seen} 位好友去过</span></div>
                <div className="wc-meta"><span>{hero.last_at ? `最近 ${new Date(hero.last_at).toLocaleDateString('zh-CN')}` : '—'}</span></div>
              </div>
            </div>
          ) : null}
          <div className="world-grid">
            {grid.map((w) => <WorldCard key={w.id} w={w} onOpen={openWorld} />)}
          </div>
        </>
      )}
    </div>
  );
}
