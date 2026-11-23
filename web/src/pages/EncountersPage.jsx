import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';
import UserHoverCard from '../components/UserHoverCard.jsx';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import RowMenu, { Hint, friendItems, useHint, useRowMenu } from '../components/RowMenu.jsx';
import { SortTh } from '../components/SortHead.jsx';
import { useListNav } from '../lib/listnav.js';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv.js';
import { useSort } from '../lib/prefs.js';
import { SORT_COLUMNS, sortRows } from '../lib/sort.js';

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

/**
 * 遇到过的玩家（原「玩家管理」槽位里的同房记录表）。
 * 真机对应的玩家管理页是屏蔽/静音流水（见 ModerationPage），这里是我们自己的扩展功能：
 * 「和谁同处过一个房间、几次、最近一次在哪」。
 */
export default function EncountersPage() {
  const { data } = useQuery({ queryKey: ['players'], queryFn: () => api('players') });
  // 101/102 表头排序，排序记在 localStorage（默认同房次数多→少）
  const [sort, onSort] = useSort('players', 'meets');
  const rows = sortRows(data?.players ?? [], SORT_COLUMNS.players, sort.key, sort.dir);
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
  // 103 导出 = 表里这几行（同一份 rows，同序），行数和页面计数一致
  const exportNow = () => {
    const { text } = toCsv([
      { key: 'name', label: '玩家' },
      { key: 'meets', label: '共处次数' },
      { key: 'last_seen', label: '最近一次' },
      { key: 'last_world', label: '世界' },
      { key: 'user_id', label: 'user_id' }
    ], rows);
    downloadCsv(csvFilename('players'), text);
  };
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-fg3">来自游戏内日志（PC 端 log-agent）。</span>
        <span className="chip ml-auto" data-count={rows.length}>共 {rows.length} 位</span>
        <button className="chip" data-export="players" onClick={exportNow} disabled={rows.length === 0}>导出 CSV</button>
      </div>
      {rows.length === 0 ? (
        <Empty icon="users" title={'还没有同房记录'} hint={'在 PC 上启动 log-agent 后才有数据。'} />
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh section="players" col="name" sort={sort} onSort={onSort} />
                <SortTh section="players" col="meets" sort={sort} onSort={onSort} style={{ width: 90 }} />
                <SortTh section="players" col="last_seen" sort={sort} onSort={onSort} style={{ width: 170 }} />
                <SortTh section="players" col="world" sort={sort} onSort={onSort} />
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
                  <td data-label="玩家">
                    <span className="flex items-center gap-2.5">
                      <UserHoverCard id={p.user_id}>
                        <InitialAvatar name={p.name} />
                      </UserHoverCard>
                      <span>{p.name}</span>
                    </span>
                  </td>
                  <td className="tabular-nums text-fg2" data-label="共处次数">{p.meets}</td>
                  <td className="text-[12px] text-fg3" data-label="最近一次">{new Date(p.last_seen).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="text-fg2" data-label="世界">{p.last_world ?? '—'}</td>
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
                  <td className="tabular-nums text-fg3" data-label="#">{i + 1}</td>
                  <td data-label="玩家">
                    <span className="flex items-center gap-2.5">
                      <UserHoverCard id={p.user_id}>
                        <InitialAvatar name={p.name} />
                      </UserHoverCard>
                      <span>{p.name}</span>
                    </span>
                  </td>
                  <td className="tabular-nums text-fg2" data-label="共处次数">{p.meets} 次</td>
                  <td className="text-[12px] text-fg3" data-label="最近一次">{new Date(p.last_seen).toLocaleString('zh-CN', { hour12: false })}</td>
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
