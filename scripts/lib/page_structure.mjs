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
export function emptyDataReason(page, got) {
  const t = got?.text || '';
  // 线上库本身没有这类数据（账号没收藏任何世界、没有屏蔽/静音记录）时，应用会渲染空态；
  // 真机截图里的「列数/列名/行高/工具条/网格列数」都建立在有行之上，不能拿来判 DIFF。
  // 信号取自页面自身文案，不额外加接口（线上没有 /api/moderation 这类路由）。
  if (page === 'favorites' && /全部收藏\s*0\/\d+/.test(t)) return '收藏夹为空';
  if (page === 'moderation' && /还没有屏蔽或静音记录/.test(t)) return '没有屏蔽/静音记录';
  return null;
}

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
/** 去掉末尾斜杠：`http://h/vrc/` 与 `http://h/vrc` 等价。带斜杠时请求会拼出 `//api/roster`（403），
 *  服务端 rewriteUrl 只认单个 `/vrc/` 前缀，必须在这里归一。 */
export const normBase = (u) => String(u).replace(/\/+$/, '');

/** 页面（hash 路由）地址要反着来：必须是带斜杠的 `http://h/vrc/`，再拼 `#/feed`。
 *  写 `http://h/vrc#/feed` 时服务端收到的是 `GET /vrc`（无尾斜杠）→ 404 JSON，
 *  而 /api/roster 预检照样通过，结果是整轮截到同一张 404 页却算 PASS（2026-11-24 踩过）。 */
export const pageBase = (u) => `${normBase(u)}/`;

/** 导航 + 一次重试：线上容器偶发连接断开（chrome-error://chromewebdata/），
 *  直接断言会把它当「页面没渲染」整轮 exit 2；这里只在真·网络错误时重试，404/白屏仍交给 assertVrcPage。 */
export async function gotoVrc(page, url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    if (!page.url().startsWith('chrome-error:')) return true;
    await page.waitForTimeout(800 * i);
  }
  return false;
}

/** 页面真的渲染出应用了（不是 404 JSON / 白屏）。三个 parity 脚本首屏后都调一次，
 *  防止「截了一排同样的 404 图还报 PASS」。 */
export async function assertVrcPage(page, label = '') {
  let got;
  for (let i = 1; ; i++) {
    try {
      got = await page.evaluate(() => {
        const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        return { text, rootKids: document.getElementById('root')?.children.length ?? -1 };
      });
      break;
    } catch (e) {
      // 首次进入带前缀的线上地址时，应用可能还在做一次跳转，evaluate 会撞上
      // "Execution context was destroyed"；这不是页面坏，重试一次即可，别当白屏。
      if (i >= 3 || !/context was destroyed|navigation/i.test(e.message)) throw e;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(400 * i);
    }
  }
  const why = got.rootKids <= 0 && got.text.length < 200
    ? `页面没渲染（root children=${got.rootKids}，文本 ${got.text.slice(0, 80)}）`
    : /"statusCode"\s*:\s*404/.test(got.text) ? '服务端 404（页面地址缺尾斜杠？用 pageBase()）' : null;
  if (why) {
    console.error(`✗ ${label || '页面'} 不可用：${why}\n  当前地址 ${page.url()}`);
    process.exit(2);
  }
}

export async function assertVrcServer(rawBase) {
  const base = normBase(rawBase);
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

