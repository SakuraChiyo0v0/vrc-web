/**
 * 页面结构断言（spec.pages[*].structure → 我们的 DOM）的共用实现。
 *
 * structure_parity.mjs 全量跑这 9 页；visual_parity.mjs 也用它，把「结构」计入每页相似度，
 * 这样两边不会各写一套然后慢慢跑偏。所有基准都来自 docs/ref/vrcx0-spec.json 的截图量测。
 */

/** 只看内容面板（排除侧栏/右栏），避免把导航文字算成页面 tab */
export const probeMain = (p) => p.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  // 我们的内容根是 .workspace（外壳重排后没有 <main>）；真机/测试页也可能用 main，两者都认
  const main = document.querySelector('.workspace') || document.querySelector('main') || document.body;
  const ths = [...main.querySelectorAll('thead th')].map(txt);
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0 && r.height > 0;
  };
  // 一屏行数要按「真的一屏装得下的条数」比，表格超出一屏时不能把滚动区的行也算进去
  const trs = [...main.querySelectorAll('tbody tr')]
    .filter((tr) => !tr.classList.contains('group-row') && inView(tr));
  const tabs = [...main.querySelectorAll('[role="tab"], .nav-tab, [data-navtab]')].map(txt);
  const subnav = [...main.querySelectorAll('[data-subnav] button, .settings-subnav button')].map(txt);
  const grid = main.querySelector('.world-grid, .fav-grid, [data-grid]');
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : null;
  const cards = main.querySelectorAll('.card').length;
  const listRows = [...main.querySelectorAll('[data-list-row]')];
  const visRows = listRows.filter(inView);
  const cellsOf = (el) => [...el.querySelectorAll('[data-cell]')].map((c) => c.dataset.cell);
  return {
    ths, tabs, subnav, gridCols: cols, cards,
    rows: visRows.length || trs.length,
    rowCells: trs[0]
      ? [...trs[0].children].filter((c) => !c.classList.contains('group-cell')).length
      : cellsOf(visRows[0] || listRows[0] || document.createElement('div')).length,
    cellNames: cellsOf(visRows[0] || listRows[0] || document.createElement('div')),
    leftListW: Math.round((main.querySelector('.sess-list')?.getBoundingClientRect().width ?? 0) * 10) / 10,
    rowH: Math.round(((visRows[0] || listRows[0])?.getBoundingClientRect().height ?? 0) * 10) / 10,
    emptyTitle: txt(main.querySelector('.empty-title, .empty h2, .sess-detail-title')),
    text: main.innerText,
  };
});

/**
 * @param page   页面名（写进报告）
 * @param got    probeMain 的结果
 * @param want   spec.pages[page].structure
 * @param pitch  spec.pages[page].row_pitch（master_detail 才用）
 */
export function structureRows(page, got, want, pitch) {
  const rows = [];
  const check = (name, ours, w, ok) => rows.push({ page, name, ours: String(ours), want: w, ok });

  if (want.columns_n) {
    // 表头存在就比表头列名；无表头的列表按首行列数比
    const n = got.ths.length || got.rowCells;
    check('列数', n, String(want.columns_n), n === want.columns_n);
    if (got.ths.length) {
      const same = want.columns.every((c, i) => got.ths[i] && (got.ths[i] === c || got.ths[i].startsWith(c) || c.startsWith(got.ths[i])));
      check('列名', got.ths.join('/'), want.columns.join('/'), same);
    } else if (want.columns?.length) {
      // 无表头的列表（真机 header_row=false）：用行内单元格语义核对列顺序
      check('列名', (got.cellNames || []).join('/'), want.columns.join('/'),
        JSON.stringify(got.cellNames) === JSON.stringify(want.columns));
    }
  }
  if (want.kind === 'master_detail' && pitch) {
    // 主从列表：一屏行数取决于数据里有几天（真机 27 条只跨 2 天），改为核对行距
    check('行距', got.rowH, String(pitch), Math.abs(got.rowH - pitch) <= 1.5);
  }
  if (want.rows_visible && want.kind !== 'master_detail') {
    // 截图里一屏可见 N 行；我们的行高不必一模一样，但一屏装得下的条数要同量级（±3）
    check('一屏行数', got.rows, `≈${want.rows_visible}`, Math.abs(got.rows - want.rows_visible) <= 3);
  }
  if (want.tabs_n !== undefined) check('tab 数', got.tabs.length, String(want.tabs_n), got.tabs.length === want.tabs_n);
  if (want.nav_tabs) check('主导航 tab 名', got.tabs.slice(0, want.nav_tabs.length).join('/'), want.nav_tabs.join('/'),
    JSON.stringify(got.tabs.slice(0, want.nav_tabs.length)) === JSON.stringify(want.nav_tabs));
  if (want.subnav_n) {
    check('子导航项数', got.subnav.length, String(want.subnav_n), got.subnav.length === want.subnav_n);
    check('子导航文字', got.subnav.join('/'), want.subnav.join('/'), got.subnav.join('/') === want.subnav.join('/'));
  }
  if (want.grid_columns) check('网格列数', got.gridCols, String(want.grid_columns), got.gridCols === want.grid_columns);
  if (want.folder_sidebar !== undefined) {
    const has = /在线收藏夹|本地收藏夹/.test(got.text);
    check('收藏夹侧栏', has, String(want.folder_sidebar), has === want.folder_sidebar);
  }
  if (want.empty_title) check('空态文案', got.emptyTitle || '(无)', want.empty_title, got.emptyTitle === want.empty_title);
  if (want.chips) check('chip', got.text.includes(want.chips[0]), want.chips.join('/'), want.chips.every((c) => got.text.includes(c)));
  if (want.groups) {
    const ok = want.groups.every((g) => got.text.includes(g));
    check('分组标题', want.groups.filter((g) => got.text.includes(g)).join('/'), want.groups.join('/'), ok);
  }
  if (want.kind === 'master_detail') {
    check('左列表宽度', got.leftListW, String(want.left_list_w), Math.abs(got.leftListW - want.left_list_w) <= 2);
    if (want.detail_empty) {
      check('详情空态标题', got.emptyTitle || '(无)', want.detail_empty[0], got.emptyTitle === want.detail_empty[0]);
      check('详情空态正文', got.text.includes(want.detail_empty[1]), want.detail_empty[1], got.text.includes(want.detail_empty[1]));
    }
  }
  if (want.kind === 'graph_canvas') {
    const hasGraph = got.text.includes('圈子') || got.text.includes('最少连接数');
    check('关系图画布', hasGraph, '圈子/最少连接数', hasGraph);
  }
  return rows;
}

/** 有 structure 量测的页面（新增页面时加这里） */
export const STRUCT_PAGES = ['search', 'sessions', 'players', 'moderation', 'favorites', 'insights', 'friendlist', 'friendlog', 'gamelog', 'settings'];
