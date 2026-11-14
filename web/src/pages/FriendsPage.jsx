import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, BASE, imgUrl } from '../api.js';
import { useDrawer } from '../components/drawers.jsx';

const STATUS_COLOR = {
  active: 'var(--status-active)',
  'join me': 'var(--status-joinme)',
  'ask me': 'var(--status-askme)',
  busy: 'var(--status-busy)',
  offline: 'var(--status-offline)'
};

function locLabel(f) {
  if (!f.location) return '未知';
  if (f.location === 'offline') return '离线';
  if (f.location === 'private') return '私密世界';
  if (f.location === 'traveling') return '切换中';
  return f.world_name || f.location;
}

function Avatar({ f }) {
  const color = STATUS_COLOR[f.status] ?? 'var(--status-offline)';
  return (
    <span className="avatar">
      {f.icon_url ? <img src={imgUrl(f.icon_url)} alt="" loading="lazy" /> : null}
      <span className="dot" style={{ background: color }} />
    </span>
  );
}

function fmtMinutes(m) {
  const n = Number(m ?? 0);
  if (n < 60) return `${n} 分钟`;
  return `${Math.floor(n / 60)} 小时 ${n % 60} 分`;
}

/** 44 今日摘要：在线时长 / 遇到的人 / 新世界 */
function TodaySummary() {
  const { data } = useQuery({
    queryKey: ['summary-today'],
    queryFn: () => api('summary/today'),
    refetchInterval: 30_000
  });
  const cards = [
    ['今日在线', fmtMinutes(data?.onlineMinutes), '自己待在房间里的累计时长'],
    ['遇到的人', data?.players ?? 0, '今天同房过的人'],
    ['新世界', data?.newWorlds ?? 0, '第一次去的世界']
  ];
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {cards.map(([label, value, hint]) => (
        <div key={label} className="card px-3 py-2" title={hint}>
          <div className="label-xs">{label}</div>
          <div className="mt-0.5 text-[15px] tabular-nums">{value}</div>
          <div className="truncate text-[10px] text-fg3">{hint}</div>
        </div>
      ))}
    </div>
  );
}

export default function FriendsPage() {
  const [only, setOnly] = useState(true);
  const [q, setQ] = useState('');
  const { openFriend } = useDrawer();
  const { data, isLoading } = useQuery({
    queryKey: ['friends', only],
    queryFn: () => api(`friends${only ? '?online=1' : ''}`)
  });

  const groups = useMemo(() => {
    const list = (data?.friends ?? []).filter((f) => !q || (f.display_name ?? '').toLowerCase().includes(q.toLowerCase()));
    const map = new Map();
    for (const f of list) {
      const k = locLabel(f);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data, q]);

  return (
    <div className="p-4">
      <TodaySummary />
      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索好友"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-60 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <button
          onClick={() => setOnly((v) => !v)}
          className="chip"
          style={only ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
        >
          {only ? '只看在线' : '全部好友'}
        </button>
        <span className="text-[11.5px] text-fg3">{data?.total ?? 0} 人</span>
        <a className="chip sm:ml-auto" href={`${BASE}api/export/friends.csv`} download>导出 CSV</a>
      </div>

      {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}

      <div className="flex flex-col gap-3">
        {groups.map(([world, people]) => (
          <section key={world} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--surface-raised)' }}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[12.5px] font-medium">{world}</span>
                <span className="text-[10.5px] text-fg3">{people.length} 人</span>
              </div>
            </div>
            <div className="grid gap-0.5 p-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((f) => (
                <div
                  key={f.user_id}
                  onClick={() => openFriend(f.user_id)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--state-hover-surface)]"
                >
                  <Avatar f={f} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px]">{f.display_name ?? f.user_id}</div>
                    <div className="truncate text-[11px] text-fg3">
                      {f.status ?? '—'}
                      {f.status_description ? `「${f.status_description}」` : ''}
                      {f.platform ? ` · ${f.platform === 'standalonewindows' ? 'PC' : f.platform === 'android' ? 'Quest' : f.platform}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10.5px] text-fg3">
                    {f.updated_at ? new Date(f.updated_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
