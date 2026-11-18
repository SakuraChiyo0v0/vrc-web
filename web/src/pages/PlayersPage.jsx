import { useQuery } from '@tanstack/react-query';
import { api, BASE } from '../api.js';
import UserHoverCard from '../components/UserHoverCard.jsx';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import RowMenu, { Hint, friendItems, useHint, useRowMenu } from '../components/RowMenu.jsx';
import { useListNav } from '../lib/listnav.js';

function InitialAvatar({ name }) {
  const ch = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <span className="avatar">
      <span
        className="flex h-full w-full items-center justify-center text-[11px] font-medium"
        style={{ color: 'var(--content-tertiary)' }}
      >
        {ch}
      </span>
    </span>
  );
}

export default function PlayersPage() {
  const { data } = useQuery({ queryKey: ['players'], queryFn: () => api('players') });
  const rows = data?.players ?? [];
  const { openFriend, close } = useDrawer();
  const { hint, say } = useHint();
  const menu = useRowMenu();
  const nav = useListNav({
    count: rows.length,
    onEnter: (i) => {
      const p = rows[i];
      if (p?.user_id) openFriend(p.user_id);
    },
    onEscape: close,
  });
  const rowMenu = (ev, p) =>
    menu.open(ev, friendItems({ id: p.user_id, name: p.name, openFriend, say }));
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">来自游戏内日志（PC 端 log-agent）。</span>
        <a className="chip ml-auto" href={`${BASE}api/export/players.csv`} download>导出 CSV</a>
      </div>
      {rows.length === 0 ? (
        <Empty icon="users" title={'还没有同房记录'} hint={'在 PC 上启动 log-agent 后才有数据。'} />
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>玩家</th>
                <th style={{ width: 90 }}>同房</th>
                <th style={{ width: 170 }}>最近一次</th>
                <th>当时的世界</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.user_id ?? p.name}
                  data-nav-idx={i}
                  data-nav-active={nav.active === i}
                  onContextMenu={(ev) => rowMenu(ev, p)}
                >
                  <td>
                    <span className="flex items-center gap-2.5">
                      <UserHoverCard id={p.user_id}>
                        <InitialAvatar name={p.name} />
                      </UserHoverCard>
                      <span>{p.name}</span>
                    </span>
                  </td>
                  <td className="tabular-nums text-fg2">{p.meets}</td>
                  <td className="text-[12px] text-fg3">{new Date(p.last_seen).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="text-fg2">{p.last_world ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="label-xs mt-5 mb-2">共处次数排行</div>
      {rows.length === 0 ? (
        <Empty icon="users" title={'暂无共处记录'} hint={'和好友同处一个房间后会自动累计次数。'} />
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56 }}>#</th>
                <th>玩家</th>
                <th style={{ width: 110 }}>共处次数</th>
                <th style={{ width: 170 }}>最近一次</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => (b.meets ?? 0) - (a.meets ?? 0)).map((p, i) => (
                <tr key={p.user_id ?? p.name}>
                  <td className="tabular-nums text-fg3">{i + 1}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <UserHoverCard id={p.user_id}>
                        <InitialAvatar name={p.name} />
                      </UserHoverCard>
                      <span>{p.name}</span>
                    </span>
                  </td>
                  <td className="tabular-nums text-fg2">{p.meets} 次</td>
                  <td className="text-[12px] text-fg3">{new Date(p.last_seen).toLocaleString('zh-CN', { hour12: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RowMenu menu={menu.menu} onClose={menu.close} />
      <Hint text={hint} />
    </div>
  );
}
