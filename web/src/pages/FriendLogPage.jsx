import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { useDrawer } from '../components/drawers.jsx';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv.js';
import { usePref, useSort } from '../lib/prefs.js';
import { SortCol } from '../components/SortHead.jsx';
import { SORT_COLUMNS, sortRows } from '../lib/sort.js';

const KIND_LABEL = {
  online: '上线',
  offline: '下线',
  location: '换世界',
  profile: '资料变更',
  status: '状态变化'
};

/** 真机时间列格式：11月22日 23:37 */
const mdhm = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

/**
 * 73 好友日志：结构逐条对齐真机 docs/ref/vrcx0-friendlog.png（crop-friendlog-head.png）：
 *   工具栏：筛选（chip，展开时间窗/类型）· 搜索好友日志 · 导出
 *   表格列（4）：时间 · 类型 · 玩家 · 操作
 *   行距 43.5（=spec.pages.friendlog.row_pitch），一屏 ~19 行
 * 89 打磨保留：游标分页（每页 100，不重复）、分类计数、CSV 导出跟随筛选。
 */
export default function FriendLogPage() {
  const [hours, setHours] = usePref('friendlog:hours', 24);
  const [kinds, setKinds] = usePref('friendlog:kinds', []);
  const [sort, onSort] = useSort('friendlog', 'at');
  const [userId, setUserId] = useState('');
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState(false);
  const { openFriend } = useDrawer();

  const { data: list } = useQuery({ queryKey: ['friend-list', 'for-log'], queryFn: () => api('friend-list?sort=name') });

  const baseParams = useMemo(() => {
    const p = new URLSearchParams({ hours: String(hours), limit: '100' });
    if (kinds.length) p.set('kinds', kinds.join(','));
    if (userId) p.set('user_id', userId);
    return p.toString();
  }, [hours, kinds, userId]);

  const qz = useInfiniteQuery({
    queryKey: ['friend-log', baseParams],
    queryFn: ({ pageParam }) => api(`friend-log?${baseParams}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 60_000
  });

  const pages = qz.data?.pages ?? [];
  // 多页拼接按 id 去重：游标在同一毫秒被截断也不会出现重复行
  const items = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of pages) {
      for (const i of p.items ?? []) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        out.push(i);
      }
    }
    return out;
  }, [pages]);

  const counts = pages[0]?.counts ?? {};
  const total = pages[0]?.total ?? 0;
  const toggleKind = (k) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  // 本地搜索只过滤已加载的行；服务端不受影响（真机搜索也是即时过滤）
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const sorted = sortRows(items, SORT_COLUMNS.friendlog, sort.key, sort.dir);
    if (!needle) return sorted;
    return sorted.filter(
      (i) =>
        String(i.display_name ?? '').toLowerCase().includes(needle) ||
        String(i.text ?? '').toLowerCase().includes(needle) ||
        String(KIND_LABEL[i.kind] ?? i.kind).includes(needle)
    );
  }, [items, sort, needle]);

  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    try {
      const all = [];
      let cursor = null;
      for (let i = 0; i < 100; i += 1) {
        const page = await api(`friend-log?${baseParams}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        all.push(...(page.items ?? []));
        cursor = page.next_cursor ?? null;
        if (!cursor) break;
      }
      const { text } = toCsv([
        { get: (r) => r.at, label: '时间' },
        { get: (r) => KIND_LABEL[r.kind] ?? r.kind, label: '类型' },
        { key: 'display_name', label: '玩家' },
        { key: 'text', label: '内容' },
        { key: 'user_id', label: 'user_id' }
      ], all);
      downloadCsv(csvFilename('friendlog'), text);
    } finally {
      setExporting(false);
    }
  };

  const selStyle = { borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)' };

  return (
    <div className="p-4">
      {/* 真机工具栏：筛选 chip · 搜索好友日志 · 导出 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          className="chip"
          data-filter-toggle="1"
          aria-pressed={panel}
          onClick={() => setPanel((v) => !v)}
          style={panel || kinds.length ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
        >
          筛选 {kinds.length ? `· ${kinds.length}` : ''}
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索好友日志"
          aria-label="搜索好友日志"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-56 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <span className="text-[12px] text-fg3" data-total={total}>
          {total} 条 · {pages[0]?.people ?? 0} 人
        </span>
        <button className="chip ml-auto" data-export="friendlog" onClick={exportNow} disabled={exporting || total === 0}>
          {exporting ? '导出中…' : '导出 CSV'}
        </button>
      </div>

      {panel ? (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-filter-panel="1">
          <select className="h-8 rounded-lg border px-2 text-[12px]" value={hours} onChange={(e) => setHours(Number(e.target.value))} style={selStyle} aria-label="时间窗">
            <option value={6}>近 6 小时</option>
            <option value={24}>近 24 小时</option>
            <option value={72}>近 3 天</option>
            <option value={168}>近 7 天</option>
          </select>
          <select className="h-8 max-w-[180px] rounded-lg border px-2 text-[12px]" value={userId} onChange={(e) => setUserId(e.target.value)} style={selStyle} aria-label="好友">
            <option value="">全部好友</option>
            {(list?.friends ?? []).map((f) => (
              <option key={f.user_id} value={f.user_id}>{f.display_name}</option>
            ))}
          </select>
          {Object.keys(KIND_LABEL).map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                className="chip kind-chip"
                data-kind={k}
                data-on={on ? '1' : '0'}
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                style={on ? { borderColor: 'var(--stroke-strong)', color: 'var(--content-primary)' } : undefined}
              >
                {KIND_LABEL[k]} <span className="tabular-nums text-fg3">{counts[k] ?? 0}</span>
              </button>
            );
          })}
          {kinds.length ? <button className="chip" data-reset="1" onClick={() => setKinds([])}>清空类型</button> : null}
        </div>
      ) : null}

      {qz.isLoading ? <Skeleton rows={8} cols={4} /> : null}

      {!qz.isLoading && !rows.length ? (
        <Empty icon="clock" title={'这个时间窗里没有记录'} hint={'放大时间窗或取消筛选再看看。'} />
      ) : null}

      {!qz.isLoading && rows.length ? (
        <div className="card overflow-hidden">
          <table className="tbl flog-tbl">
            <thead>
              <tr>
                <th><SortCol section="friendlog" col="at" sort={sort} onSort={onSort} /></th>
                <th><SortCol section="friendlog" col="kind" sort={sort} onSort={onSort} /></th>
                <th><SortCol section="friendlog" col="name" sort={sort} onSort={onSort} /></th>
                <th className="flog-act">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} data-id={i.id} className="cursor-pointer" onClick={() => openFriend(i.user_id)}>
                  <td className="tabular-nums text-[12px] text-fg3" data-label="时间">{mdhm(i.at)}</td>
                  <td className="text-[12px] text-fg2" data-label="类型">
                    <span className="flex items-center gap-1.5">
                      <span className="dot" style={{ background: i.kind === 'online' ? 'var(--status-active)' : i.kind === 'offline' ? 'var(--status-offline)' : 'var(--content-secondary)' }} />
                      {KIND_LABEL[i.kind] ?? i.kind}
                    </span>
                  </td>
                  <td className="min-w-0" data-label="玩家">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="avatar">
                        {i.icon_url ? <img src={imgUrl(i.icon_url)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                      </span>
                      <span className="shrink-0 truncate">{i.display_name ?? i.user_id}</span>
                      {i.text ? <span className="min-w-0 truncate text-[11px] text-fg3">{i.text}</span> : null}
                    </span>
                  </td>
                  <td className="flog-act" data-label="操作">
                    <button
                      className="chip"
                      disabled
                      title="本站的好友日志只读：采集数据不做删除"
                      style={{ height: 22, fontSize: 11 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!qz.isLoading && rows.length ? (
        <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-fg3">
          <span>已显示 {rows.length} / {total} 条</span>
          {qz.hasNextPage ? (
            <button className="chip" data-more="1" disabled={qz.isFetchingNextPage} onClick={() => qz.fetchNextPage()}>
              {qz.isFetchingNextPage ? '加载中…' : '加载更多'}
            </button>
          ) : total > 0 ? <span>· 已经到底</span> : null}
        </div>
      ) : null}
    </div>
  );
}
