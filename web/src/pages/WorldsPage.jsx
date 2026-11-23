import { useQuery } from '@tanstack/react-query';
import { ErrorCard } from '../components/ErrorBoundary.jsx';
import { useState } from 'react';
import { api, imgUrl } from '../api.js';
import Empty from '../components/Empty.jsx';
import { useDrawer } from '../components/drawers.jsx';
import { SortCol } from '../components/SortHead.jsx';
import { csvFilename, downloadCsv, toCsv } from '../lib/csv.js';
import { usePref, useSort } from '../lib/prefs.js';

const fmt = (v) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

// 90 缩略图 4:3 圆角铺满卡片（真机 316×237）；没有图就留同比例灰底 +首字，网格不会跳
// 2 倍档：整页 zoom 把 2560+/3000+ 视口的卡片渲染宽推到 516~855 设备 px，512 档会被放大发虚。
// media 断点按「视口宽」判（CSS zoom 不影响 media query，实测 2560 起需要大档）：
//   1700→316px、1920→352px、2560→516px、3840→855px（设备 px）；≤2560 仍只取 512，不加带宽。
// 请求 1024：VRChat 世界缩略图这一档实际回 800×600（文件上限），3840 下 855/800=1.07×。
const BIG_THUMB_MIN_W = 2560;

function Thumb({ w }) {
  if (w.thumbnail) {
    return (
      <picture>
        <source media={`(min-width: ${BIG_THUMB_MIN_W}px)`} srcSet={imgUrl(w.thumbnail, 1024)} />
        <img
          className="thumb"
          src={imgUrl(w.thumbnail, 512)}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { className: 'thumb thumb-empty', textContent: (w.name ?? '?').slice(0, 1) })); }}
        />
      </picture>
    );
  }
  return <div className="thumb thumb-empty">{(w.name ?? '?').slice(0, 1)}</div>;
}

/** 41 世界库：所有去过的世界，搜索 + 表头排序（名字/作者/访问次数/最近活跃），点进详情 */
export default function WorldsPage() {
  // 102 搜索词与排序写到 localStorage，刷新保持
  const [q, setQ] = usePref('worlds:q', '');
  const [sort, onSort] = useSort('worlds', 'recent');
  const [offset, setOffset] = useState(0);
  // 114 三个筛选项，和搜索/排序一起进 queryKey，刷新后保持
  const [fav, setFav] = usePref('worlds:fav', false);
  const [minVisits, setMinVisits] = usePref('worlds:minVisits', 0);
  const [capacity, setCapacity] = usePref('worlds:capacity', 'any');
  const changeSort = (key) => { onSort(key); setOffset(0); };
  const { openWorld } = useDrawer();
  const LIMIT = 50;

  const filterQs = (extra = '') =>
    `q=${encodeURIComponent(q)}&sort=${sort.key}&dir=${sort.dir}&fav=${fav ? 1 : 0}` +
    `&min_visits=${Number(minVisits) || 0}&capacity=${encodeURIComponent(capacity)}${extra}`;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['worlds', q, sort.key, sort.dir, fav, minVisits, capacity, offset],
    queryFn: () => api(`worlds?${filterQs(`&limit=${LIMIT}&offset=${offset}`)}`),
  });

  const rows = data?.worlds ?? [];

  // 103 导出跟随筛选：按同样的 q/sort/dir 一页页取到底（接口单页上限 200），
  // 行数 = 顶部「共 N 个世界」，和当前筛选看到的一致。
  const [exporting, setExporting] = useState(false);
  const exportNow = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let off = 0; off < 5000; off += 200) {
        const page = await api(`worlds?${filterQs(`&limit=200&offset=${off}`)}`);
        all.push(...(page.worlds ?? []));
        if (!page.has_more) break;
      }
      const { text } = toCsv([
        { key: 'name', label: '世界' },
        { key: 'author_name', label: '作者' },
        { key: 'visits', label: '到访次数' },
        { key: 'friends_seen', label: '见过的好友' },
        { key: 'capacity', label: '容量' },
        { get: (w) => fmt(w.last_at), label: '最近活跃' },
        { key: 'id', label: 'world_id' }
      ], all);
      downloadCsv(csvFilename(`worlds${q ? '-筛选' : ''}`), text);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="worlds-page">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }}
          placeholder="搜索世界 / 作者"
          className="h-8 min-w-0 flex-1 rounded-lg border px-2.5 text-[12px] outline-none sm:w-64 sm:flex-none"
          style={{ borderColor: 'var(--stroke-subtle)', background: 'var(--surface-panel)', color: 'var(--content-primary)' }}
        />
        <button
          className="chip"
          data-filter="fav"
          data-active={fav ? 'true' : 'false'}
          onClick={() => { setFav(!fav); setOffset(0); }}
          title="只看收藏过的世界"
        >
          {fav ? '只看收藏' : '收藏'}
        </button>
        <select
          className="chip"
          data-filter="visits"
          value={String(minVisits)}
          onChange={(e) => { setMinVisits(Number(e.target.value)); setOffset(0); }}
          title="按我的到访次数筛选"
        >
          <option value="0">次数不限</option>
          <option value="1">去过 ≥1 次</option>
          <option value="3">去过 ≥3 次</option>
          <option value="10">去过 ≥10 次</option>
        </select>
        <select
          className="chip"
          data-filter="capacity"
          value={capacity}
          onChange={(e) => { setCapacity(e.target.value); setOffset(0); }}
          title="按世界容量筛选"
        >
          <option value="any">容量不限</option>
          <option value="small">≤8 人</option>
          <option value="mid">9–16 人</option>
          <option value="large">17–32 人</option>
          <option value="huge">33 人以上</option>
        </select>
        <span className="chip sm:ml-auto" data-count={data?.total ?? 0}>共 {data?.total ?? 0} 个世界</span>
        <button className="chip" data-export="worlds" onClick={exportNow} disabled={exporting || !data?.total}>
          {exporting ? '导出中…' : '导出 CSV'}
        </button>
      </div>

      {/* 101 世界库列头：点一下排序，再点切方向 */}
      <div className="world-head" data-sort-head="worlds">
        <SortCol section="worlds" col="name" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="author" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="visits" sort={sort} onSort={changeSort} />
        <SortCol section="worlds" col="recent" sort={sort} onSort={changeSort} />
      </div>

      {isLoading ? (
        <div className="text-[12px] text-fg3">加载中…</div>
      ) : isError && rows.length === 0 ? (
        // 接口挂了不能显示「还没有去过的世界」——那是在骗人说库是空的
        <ErrorCard title="世界库读不出来" error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <Empty icon="star" title={'还没有去过的世界'} hint={'采集器记录到自己进出世界后会出现在这里。'} />
      ) : (
        <div className="world-grid">
          {rows.map((w) => (
            <div key={w.id} className="world-card" onClick={() => openWorld(w.id)} title={`${w.name}\n最近活跃 ${fmt(w.last_at)}`}>
              <Thumb w={w} />
              <div className="wc-body">
                <div className="wc-name">{w.fav ? <span data-fav="1" title="已收藏">★ </span> : null}{w.name}</div>
                {/* 真机卡片文字只有「标题 + 一行元信息」（左作者·容量 / 右次数·好友数），
                    最近活跃时间放 title 提示里，不额外占一行 */}
                <div className="wc-meta">
                  <span>{w.author_name ?? '未知作者'}{w.capacity ? ` ·容量 ${w.capacity}` : ''}</span>
                  <span>{w.visits}次 · {w.friends_seen}人</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.has_more || offset > 0 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button className="chip" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            上一页
          </button>
          <span className="text-[12px] text-fg3">
            {offset + 1}–{offset + rows.length} / {data?.total ?? 0}
          </span>
          <button className="chip" disabled={!data?.has_more} onClick={() => setOffset(offset + LIMIT)}>
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
