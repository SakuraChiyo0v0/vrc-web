import { useDeferredValue, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import { hashParams, useHashState } from '../lib/hashQuery.js';

/**
 * 111 独立搜索页：#/search?q=xx 深链可直开。
 * 好友 / 世界 / 玩家三区各自成段，段头带命中总数（接口 counts，不是当前页条数），
 * 点条目开对应抽屉——和 ⌘K 浮层同一套动作，但能看更多（limit=30）且可分享地址。
 */
const LIMIT = 30;
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—');

function Section({ zone, title, count, shown, children, empty }) {
  return (
    <section className="mb-4" data-zone={zone} data-count={count ?? 0}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="label-xs">{title}</span>
        <span className="text-[11px] tabular-nums text-fg3">
          {count ? `${count} 个结果${count > shown ? ` · 显示前 ${shown}` : ''}` : '无'}
        </span>
      </div>
      {count ? <div className="card divide-y" style={{ borderColor: 'var(--stroke-subtle)' }}>{children}</div> : empty}
    </section>
  );
}

export default function SearchPage({ onNavigate }) {
  const [st, setSt] = useHashState({ q: '' });
  const q = st.q ?? '';
  const dq = useDeferredValue(q).trim();
  const inputRef = useRef(null);
  const { openFriend, openWorld } = useDrawer();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // 浮层「在搜索页查看全部」是改 hash 过来的：页面已挂着时也要跟着换词
  useEffect(() => {
    const onHash = () => {
      if (!/^#\/search\b/.test(window.location.hash)) return;
      const next = hashParams(window.location.hash).get('q') ?? '';
      setSt({ q: next });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['search-page', dq],
    queryFn: () => api(`search?limit=${LIMIT}&q=${encodeURIComponent(dq)}`),
    enabled: dq.length > 0,
    staleTime: 15_000,
  });

  const friends = data?.friends ?? [];
  const worlds = data?.worlds ?? [];
  const players = data?.players ?? [];
  const counts = data?.counts ?? { friends: 0, worlds: 0, players: 0 };
  const total = counts.friends + counts.worlds + counts.players;

  return (
    <div className="p-4" data-page="search">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setSt({ q: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Escape') setSt({ q: '' }); }}
          placeholder="搜好友、世界、玩家…（支持拼音首字母）"
          aria-label="搜索"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-80 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        {dq ? (
          <span className="chip" data-search-total={total}>
            {isFetching ? '搜索中…' : `${total} 个结果`}
          </span>
        ) : null}
        <button className="chip sm:ml-auto" onClick={() => onNavigate?.('friends')}>回到好友位置</button>
      </div>

      {!dq ? (
        <Empty icon="users" title="输入名字开始搜索" hint="好友、去过的世界、同房遇到的玩家会分三区列出；⌘K 是同一个搜索的浮层版。" />
      ) : isError ? (
        <div className="card p-6 text-[12px] text-fg3">
          搜索失败：{error?.message}
          <button className="chip ml-2" onClick={() => refetch()}>重试</button>
        </div>
      ) : (
        <>
          <Section zone="friends" title="好友" count={counts.friends} shown={friends.length}
            empty={<Empty compact title="没有匹配的好友" hint="试试拼音首字母，例如 xh 命中「小红」。" />}>
            {friends.map((f) => (
              <button
                key={f.user_id}
                onClick={() => openFriend(f.user_id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:brightness-[0.98]"
                data-result="friend"
              >
                {f.icon_url ? (
                  <img src={imgUrl(f.icon_url)} alt="" className="size-6 shrink-0 rounded-full object-cover" loading="lazy" />
                ) : <span className="size-6 shrink-0 rounded-full" style={{ background: 'var(--surface-raised)' }} />}
                <span className="min-w-0 flex-1 truncate text-[12px]">{f.display_name ?? f.user_id}</span>
                <span className="shrink-0 truncate text-[11px] text-fg3">{f.world_name ?? f.location ?? '离线'}</span>
              </button>
            ))}
          </Section>

          <Section zone="worlds" title="世界" count={counts.worlds} shown={worlds.length}
            empty={<Empty compact icon="star" title="没有匹配的世界" hint="世界名和作者名都参与匹配。" />}>
            {worlds.map((w) => (
              <button
                key={w.id}
                onClick={() => openWorld(w.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:brightness-[0.98]"
                data-result="world"
              >
                {w.thumbnail ? (
                  <img src={imgUrl(w.thumbnail)} alt="" className="h-6 w-10 shrink-0 rounded object-cover" loading="lazy" />
                ) : <span className="h-6 w-10 shrink-0 rounded" style={{ background: 'var(--surface-raised)' }} />}
                <span className="min-w-0 flex-1 truncate text-[12px]">{w.name ?? w.id}</span>
                <span className="shrink-0 truncate text-[11px] text-fg3">{w.author_name ?? '未知作者'}</span>
              </button>
            ))}
          </Section>

          <Section zone="players" title="玩家" count={counts.players} shown={players.length}
            empty={<Empty compact icon="users" title="没有同房遇到过的玩家" hint="只统计进房记录里的名字。" />}>
            {players.map((p) => (
              <button
                key={p.user_id ?? p.name}
                onClick={() => (p.user_id ? openFriend(p.user_id) : onNavigate?.('players'))}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:brightness-[0.98]"
                data-result="player"
              >
                <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-fg3">{p.meets} 次 · {fmtDay(p.last_seen)}</span>
              </button>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
