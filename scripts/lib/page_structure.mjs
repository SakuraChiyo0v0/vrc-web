/**
 * 页面结构断言（spec.pages[*].structure → 我们的 DOM）的共用实现。
 *
 * structure_parity.mjs 全量跑这 9 页；visual_parity.mjs 也用它，把「结构」计入每页相似度，
 * 这样两边不会各写一套然后慢慢跑偏。所有基准都来自 docs/ref/vrcx0-spec.json 的截图量测。
 */

/**
 * 数据相关分栏：真机基准截图里收藏桶有好友在线，账号没有收藏好友时不该要求「好友收藏」这栏。
 * structure_parity / visual_parity 都走这里，保证口径一致。
 */
export function dataDependentWant(page, want, roster) {
  if (page === 'locations' && want?.groups?.length && !(roster?.facets?.favorite > 0)) {
    return { ...want, groups: want.groups.filter((g) => g !== '好友收藏') };
  }
  return want;
}

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
  // 好友位置页卡片几何（spec.friends_locations 的像素量测）
  const fc = main.querySelector('.loc-card');
  const fav = fc?.querySelector('.avatar');
  const fbody = fc?.querySelector('.loc-body');
  const fcs = fc ? getComputedStyle(fc) : null;
  const friendCard = fc ? {
    h: Math.round(fc.getBoundingClientRect().height * 10) / 10,
    w: Math.round(fc.getBoundingClientRect().width * 10) / 10,
    avatar: Math.round((fav?.getBoundingClientRect().width ?? 0) * 10) / 10,
    avatarRadius: fav ? getComputedStyle(fav).borderRadius : '',
    borderW: fcs ? parseFloat(fcs.borderTopWidth) || 0 : 0,
    bg: fcs?.backgroundColor ?? '',
    lines: fbody ? fbody.children.length : 0,
    heads: [...main.querySelectorAll('.loc-head .loc-title')].map(txt)
  } : null;
  // 概览右栏三榜单（spec.pages.overview.structure）：节标题 + 每节首行是否存在
  const ovsecs = [...main.querySelectorAll('.ov-sec')];
  const overview = ovsecs.length ? {
    titles: ovsecs.map((s) => txt(s.querySelector('.ov-list-title'))),
    // 榜单为空时真机也只有标题（截图里后两块无行）→ 该节可无首名行
    heroPer: ovsecs.map((s) => ({ rows: s.querySelectorAll('.ov-person').length, hero: !!s.querySelector('.ov-person-hero') })),
    heroAvatar: Math.round((main.querySelector('.ov-sec .ov-person-hero .ov-av')?.getBoundingClientRect().width ?? 0)),
  } : null;
  const cards = main.querySelectorAll('.card').length;
  const listRows = [...main.querySelectorAll('[data-list-row]')];
  const visRows = listRows.filter(inView);
  const cellsOf = (el) => [...el.querySelectorAll('[data-cell]')].map((c) => c.dataset.cell);
  return {
    ths, tabs, subnav, gridCols: cols, cards, friendCard, overview,
    rows: visRows.length || trs.length,
    rowCells: trs[0]
      ? [...trs[0].children].filter((c) => !c.classList.contains('group-cell')).length
      : cellsOf(visRows[0] || listRows[0] || document.createElement('div')).length,
    cellNames: cellsOf(visRows[0] || listRows[0] || document.createElement('div')),
    leftListW: Math.round((main.querySelector('.sess-list')?.getBoundingClientRect().width ?? 0) * 10) / 10,
    thWidths: ths.map((_, i) => Math.round([...main.querySelectorAll('thead th')][i].getBoundingClientRect().width)),
    rowH: Math.round(((visRows[0] || listRows[0] || trs[0])?.getBoundingClientRect().height ?? 0) * 10) / 10,
    emptyTitle: txt(main.querySelector('.empty-title, .empty h2, .sess-detail-title')),
    // 工具条里输入框的 placeholder / aria-label 在截图上是看得见的文字（真机搜索框就是
    // 灰色 placeholder「搜索」），innerText 读不到，单独收一份给工具条断言
    formText: [...main.querySelectorAll('input, textarea, select')]
      .map((el) => [el.placeholder, el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' '))
      .join(' '),
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
  if (want.row_h) {
    // 表格行高（真机像素量测）：行距与表头高度都直接可比
    check('行高', got.rowH, String(want.row_h), Math.abs(got.rowH - want.row_h) <= 1.5);
  }
  if (want.column_widths?.length && got.thWidths?.length) {
    const diffs = want.column_widths.map((w, i) => Math.abs((got.thWidths[i] ?? 0) - w));
    check('列宽', got.thWidths.slice(0, want.column_widths.length).join('/'), want.column_widths.join('/'),
      diffs.every((d) => d <= 3));
  }
  if (want.toolbar?.length) {
    const bar = `${got.text} ${got.formText || ''}`;
    check('工具条', want.toolbar.filter((t) => bar.includes(t)).join('/'), want.toolbar.join('/'),
      want.toolbar.every((t) => bar.includes(t)));
  }
  if (want.type_labels?.length) {
    // 类型列文案各至少出现一次（表格数据里应有这些事件）
    check('类型文案', want.type_labels.filter((t) => got.text.includes(t)).join('/'), want.type_labels.join('/'),
      want.type_labels.every((t) => got.text.includes(t)));
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
  if (want.kind === 'friend_grid') {
    const c = got.friendCard;
    check('卡片存在', c ? '有' : '无', '有', !!c);
    if (c) {
      check('卡片高', c.h, String(want.card_height), Math.abs(c.h - want.card_height) <= 1.5);
      check('头像尺寸', c.avatar, String(want.avatar_size), Math.abs(c.avatar - want.avatar_size) <= 1);
      check('头像正圆', c.avatarRadius, want.card_avatar_radius || '50%', c.avatarRadius === (want.card_avatar_radius || '50%'));
      check('卡片边框', c.borderW, String(want.card_border_px ?? 1), c.borderW === (want.card_border_px ?? 1));
      check('卡片行数', c.lines, `1~${want.lines_per_card}`, c.lines > 1 && c.lines <= want.lines_per_card);
    }
    check('分栏标题', (c?.heads ?? []).join('/'), want.groups.join('/'),
      want.groups.every((g) => (c?.heads ?? []).some((h) => h.includes(g))));
  }
  if (want.kind !== 'friend_grid' && want.groups) {
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
  if (want.kind === 'overview_lists') {
    // 概览右栏三块榜单：节标题文案与真机一致，每节都有首名 hero 行（头像由视觉通道量尺寸）
    const o = got.overview;
    check('榜单节数', o ? o.titles.length : 0, String(want.lists.length), !!o && o.titles.length === want.lists.length);
    check('榜单标题', (o?.titles ?? []).join('/'), want.lists.join('/'),
      !!o && JSON.stringify(o.titles) === JSON.stringify(want.lists));
    const hp = o?.heroPer ?? [];
    check('榜单首名行', hp.map((x) => (x.hero ? '有' : x.rows ? '缺' : '空')).join('/'), '有/有或空',
      !!o && hp.every((x) => x.hero || x.rows === 0));
    check('榜单首名头像', o?.heroAvatar ?? 0, String(want.hero_avatar_d),
      !!o && Math.abs(o.heroAvatar - want.hero_avatar_d) <= 2);
  }
  if (want.kind === 'graph_canvas') {
    const hasGraph = got.text.includes('圈子') || got.text.includes('最少连接数');
    check('关系图画布', hasGraph, '圈子/最少连接数', hasGraph);
  }
  return rows;
}

/** 有 structure 量测的页面（新增页面时加这里） */
export const STRUCT_PAGES = ['overview', 'search', 'feed', 'sessions', 'players', 'moderation', 'favorites', 'insights', 'friendlist', 'friendlog', 'gamelog', 'settings', 'locations'];

/** spec 页名 → 我们的路由名（真机「好友位置」= 我们的 #/friends） */
export const PAGE_ROUTES = { locations: 'friends' };

/**
 * 端口预检：8899 在 NAS 上常被图片墙（imagewall）容器占着，对那种端口会截出「别人的 200」，
 * 之后所有断言要么假通过要么全红。所以除了 HTTP 200，还要求 /api/roster 是本服务的 JSON。
 */
export async function assertVrcServer(base) {
  const fail = (why) => {
    console.error(`✗ baseUrl 不是本服务：${base}（${why}）\n  先起 mock+构建产物：node server/scripts/demo.mjs 8891`);
    process.exit(2);
  };
  let res;
  try { res = await fetch(`${base}/api/roster`, { redirect: 'manual' }); } catch (e) { fail(e.message); }
  if (res.status !== 200) fail(`/api/roster HTTP ${res.status}`);
  let body;
  try { body = await res.json(); } catch { fail('/api/roster 不是 JSON，端口被别的服务占用'); }
  if (typeof body?.total !== 'number' || !Array.isArray(body?.groups)) fail('/api/roster 缺 total/groups，不是 vrc-web');
  return body;
}

