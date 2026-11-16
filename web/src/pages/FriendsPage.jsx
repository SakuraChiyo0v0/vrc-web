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
  // 世界元数据拉不到（私有/已删除/接口失败）时显示人话，不要把 wrld_xxx 甩给用户
  if (f.world_name) return f.world_name;
  if (String(f.location).startsWith('wrld_')) return '未知世界';
  return f.location;
}

function Avatar({ f }) {
  const color = STATUS_COLOR[f.status] ?? 'var(--status-offline)';
  return (
    <span className="avatar">
      {f.icon_url ? (
        <img
          src={imgUrl(f.icon_url)}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
      ) : null}
      <span className="dot" style={{ background: color }} />
    </span>
  );
}

/** 64 平台徽章：PC/Quest/iOS 各自品牌色，未知平台回落灰字 */
function Platform({ p }) {
  if (!p) return null;
  const key = p === 'standalonewindows' ? 'pc' : p === 'android' ? 'quest' : p === 'ios' ? 'ios' : 'web';
  const label = key === 'pc' ? 'PC' : key === 'quest' ? 'Quest' : key === 'ios' ? 'iOS' : p;
  return <span className="plat" data-p={key}>{label}</span>;
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
    <div className="mb-3 summary-grid">
      {cards.map(([label, value, hint]) => (
        <div key={label} className="card px-3 py-2" title={hint}>
          <div className="label-xs">{label}</div>
          <div className="mt-0.5 text-[14px] tabular-nums">{value}</div>
          <div className="truncate text-[11px] text-fg3">{hint}</div>
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
        <span className="text-[12px] text-fg3">{data?.total ?? 0} 人</span>
        <a className="chip sm:ml-auto" href={`${BASE}api/export/friends.csv`} download>导出 CSV</a>
      </div>

      {isLoading && <div className="text-[12px] text-fg3">加载中…</div>}

      {/* 61 单列 32px 行列表（VRCX-0 compact 档），不再三列卡片网格 */}
      <div className="flex flex-col gap-2">
        {groups.map(([world, people]) => (
          <section key={world} className="card overflow-hidden">
            <div className="group-head" style={{ background: 'var(--surface-raised)' }}>
              <span className="truncate font-medium">{world}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-fg3">{people.length} 人</span>
            </div>
            <div className="flex flex-col p-1">
              {people.map((f) => (
                <div key={f.user_id} className="friend-row" onClick={() => openFriend(f.user_id)}>
                  <Avatar f={f} />
                  <span className="min-w-0 flex-1 truncate">{f.display_name ?? f.user_id}</span>
                  <span className="hidden min-w-0 max-w-[42%] truncate text-fg2 sm:block">
                    {f.status ?? '—'}
                    {f.status_description ? `「${f.status_description}」` : ''}
                  </span>
                  <Platform p={f.platform} />
                  <span className="shrink-0 tabular-nums text-fg3">
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
