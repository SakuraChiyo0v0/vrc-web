/**
 * 视觉对齐评测：把「我们 vs VRCX-0 规格」变成可量化的数字，而不是靠看图说话。
 *
 *   node scripts/visual_parity.mjs [baseUrl]
 *
 * 覆盖 6 个页面（好友位置 / 动态 / 好友抽屉 / 概览 / 世界库 / 通知），做三件事：
 *   1) 在 390 / 1440 / 3840 三个宽度截我们的页面（存 docs/screenshots/compare/）
 *   2) 用 DOM 实测关键尺寸（行高、字号档位、头像、列数、圆角、缩略图比例），和 docs/ref/vrcx0-spec.json 比
 *   3) 输出每项 PASS/DIFF + 相似度百分比；有 DIFF 就 exit 1（可进 parity）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { probeMain, structureRows, STRUCT_PAGES, assertVrcServer, normBase, pageBase, assertVrcPage, gotoVrc, dataDependentWant } from './lib/page_structure.mjs';
// playwright 不在本仓库依赖里（容器只有一份装在 hermes 模板目录），ESM 不吃 NODE_PATH，按路径 require
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = normBase(process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891');
const PAGE = pageBase(BASE); // hash 路由要用带尾斜杠的地址（见 page_structure.pageBase）
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const OUT = path.join(ROOT, 'docs/screenshots/compare');
fs.mkdirSync(OUT, { recursive: true });

const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const ALLOWED = SPEC.typography.px_sizes_allowed;
const rows = [];
let CUR = null; // 当前断言属于哪一页（用于按页汇总相似度）
// 断言归属到「页」，不是「页@宽度」：390/4k 的溢出检查也算到该页头上
const pageKeyOf = (cur) => String(cur ?? '').split('@')[0];
const check = (name, ours, want, ok) => {
  rows.push({ page: CUR, key: pageKeyOf(CUR), name, ours, want, ok });
};

// 预检：baseUrl 不通、或是别人的服务（8899 上常驻图片墙）时整轮会量到空页面/别人的页面，
// 给出假分数（曾对死端口跑出 95/166、对图片墙跑出全红），必须硬失败
const roster = await assertVrcServer(BASE);

// 这套断言的真机基准是在「种子数据」上量的（动态 4 列表、模态 8 个 tab、概览 24 格柱图、收藏夹满 150），
// 线上真实库的数据形态不同（动态/收藏可能为空），跑出来 46% 会被误读成视觉回归（2026-11-24 10:54 踩过）。
// 只对 seed 实例（demo.mjs → sqlite 临时库）有意义；真实库要跑，显式 VRC_ALLOW_REAL=1。
const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
const dbKind = health?.db?.kind ?? 'unknown';
if (dbKind !== 'sqlite' && process.env.VRC_ALLOW_REAL !== '1') {
  console.error(`SKIP 视觉基准只对 seed 实例有效（当前 db=${dbKind}，${BASE}）`);
  console.error('  真机基准里的行列数/模态 tab/概览柱都依赖种子数据，真实库数据形态不同，分数无意义。');
  console.error('  跑法：node server/scripts/demo.mjs 8891 && node scripts/visual_parity.mjs http://127.0.0.1:8891');
  console.error('  确认要在真实库上看：加 VRC_ALLOW_REAL=1（结果只作参考，别当回归门）。');
  process.exit(3);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

let tab = null; // 当前复用的 page（1440 档），换宽度就重开

/** 开页：hash 直达（App 有 hashchange 监听），等首屏有内容再截图 */
async function open(pageName, { width = 1440, height = 960, fresh = false, ready } = {}) {
  if (!tab || tab.isClosed() || fresh || tab.viewportSize().width !== width) {
    if (tab) await tab.close().catch(() => {});
    tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  }
  // 页面里有轮询（好友/在线状态）时 networkidle 永远等不到，用 domcontentloaded + 就绪选择器
  await gotoVrc(tab, `${PAGE}#/${pageName}`);
  if (ready) await tab.waitForSelector(ready, { timeout: 25000 }).catch(() => {});
  await tab.waitForTimeout(1500);
  await assertVrcPage(tab, pageName); // 404/白屏当场硬失败，别去量空 DOM
  return tab;
}

const shot = async (p, name) => p.screenshot({ path: path.join(OUT, name) }).catch(() => {});

/** 页面正文可见节点的字号档位（head/meta 的默认 16px 不算；可排除大数字选择器） */
const fontSizesOf = (p, exclude = []) => p.evaluate((sels) => {
  const sizes = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.offsetParent) return;
    if (!(el.textContent || '').trim()) return;
    if (sels.some((s) => el.closest(s))) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px > 0) sizes.add(Math.round(px));
  });
  return [...sizes].sort((a, b) => a - b);
}, exclude);

const overflowOf = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
const offSpec = (sizes) => sizes.filter((s) => !ALLOWED.includes(s));

// ══ 1. 好友位置页（默认页） ══
CUR = 'friends';
let p = await open('friends', { ready: '.friend-row:not(.list-head), .card' });
await shot(p, 'friends-1440.png');

const measured = await p.evaluate(() => {
  // 默认网格：真机好友位置页是 96px 白底 1px 细边框卡片（spec.friends_locations），
  // 不是旧版 32–40 的紧凑列表行；列表视图是我们自己的额外档位，真机截图里没有
  const row = document.querySelector('.loc-card') || document.querySelector('.friend-row:not(.list-head)');
  const avatar = row?.querySelector('.avatar') || document.querySelector('.friend-row:not(.list-head) .avatar');
  const navItem = document.querySelector('aside button, nav button');
  const cs = row ? getComputedStyle(row) : null;
  return {
    rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
    avatarSize: avatar ? Math.round(avatar.getBoundingClientRect().width) : null,
    rowBorder: cs ? cs.borderTopWidth : null,
    rowBg: cs ? cs.backgroundColor : null,
    navItemHeight: navItem ? Math.round(navItem.getBoundingClientRect().height) : null,
    tabular: getComputedStyle(document.body).fontVariantNumeric
  };
});
const friendSizes = await fontSizesOf(p);

// 基准取 spec.friends_locations（2026-11-23 真机复核：6 列 96px 卡片 / 56 头像 / 1px 边框 / 白底）
const FL = SPEC.friends_locations;
const flBorder = FL.card_border_px ?? (parseFloat(FL.card_border) || 1);
check('好友卡片高', `${measured.rowHeight}px`, `${FL.card_height}px`,
  measured.rowHeight != null && Math.abs(measured.rowHeight - FL.card_height) <= 1.5);
check('头像尺寸', `${measured.avatarSize}px`, `${FL.avatar_size}px`, measured.avatarSize === FL.avatar_size);
check('卡片细边框', measured.rowBorder, `${flBorder}px`, measured.rowBorder === `${flBorder}px`);
check('卡片非透明底', measured.rowBg, '不透明',
  !!measured.rowBg && measured.rowBg !== 'transparent' && measured.rowBg !== 'rgba(0, 0, 0, 0)');
check('字号档位', friendSizes.join('/'), ALLOWED.join('/'), offSpec(friendSizes).length === 0);
check('数字等宽', measured.tabular, 'tabular-nums', String(measured.tabular).includes('tabular'));

// ══ 2. 动态页（表格四列） ══
CUR = 'feed';
p = await open('feed', { ready: 'thead th' });
await shot(p, 'feed-1440.png');
const feed = await p.evaluate(() => {
  const ths = [...document.querySelectorAll('thead th')].map((t) => t.textContent.trim());
  const tr = document.querySelector('tbody tr');
  return {
    columnCount: ths.length,
    columns: ths.join('/'),
    rowHeight: tr ? Math.round(tr.getBoundingClientRect().height) : null,
    hasAvatar: !!document.querySelector('tbody img'),
    headerTransform: document.querySelector('thead th') ? getComputedStyle(document.querySelector('thead th')).textTransform : ''
  };
});
const feedSizes = await fontSizesOf(p);

check('动态表头列数', feed.columnCount, SPEC.feed_table.columns, feed.columnCount === SPEC.feed_table.columns);
check('动态列名', feed.columns, SPEC.feed_table.column_names.join('/'), feed.columns.includes('时间') && feed.columns.includes('类型'));
check('动态行高', `${feed.rowHeight}px`, '≤48px', feed.rowHeight != null && feed.rowHeight <= 48);
check('动态无头像', String(feed.hasAvatar), 'false', feed.hasAvatar === false);
check('表头不大写', feed.headerTransform, 'none', feed.headerTransform === 'none');
check('动态字号档位', feedSizes.join('/'), ALLOWED.join('/'), offSpec(feedSizes).length === 0);

// ══ 3. 好友详情模态（1025×546 居中，量测自 docs/ref/vrcx0-friend.png） ══
// 真机是「大模态工作台」不是窄抽屉：左资料栏 285 + 右水平 tab + 双列卡片（419/256，栏距 15）。
CUR = 'drawer';
p = await open('friends', { width: 1280, height: 756, fresh: true, ready: '.friend-row:not(.list-head)' });
await p.locator('.friend-row[data-user="usr_alice"]').click({ timeout: 8000, force: true }).catch(async () => {
  await p.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true }).catch(() => {});
});
await p.waitForSelector('.fd-card', { timeout: 12000 }).catch(() => {});
await p.waitForTimeout(800);
const FM = SPEC.friend_modal;
const fm = await p.evaluate(() => {
  const rect = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const card = rect('.fd-card');
  const cs = card && document.querySelector('.fd-card') ? getComputedStyle(document.querySelector('.fd-card')) : null;
  const left = rect('.fd-left');
  const grid = document.querySelector('.fd-grid');
  const gcs = grid ? getComputedStyle(grid) : null;
  const tabs = [...document.querySelectorAll('.fd-tabs button')].map((t) => t.textContent.replace(/\d+/g, '').trim());
  return {
    w: card ? Math.round(card.w) : null,
    h: card ? Math.round(card.h) : null,
    centerDx: card ? Math.round(card.x + card.w / 2 - window.innerWidth / 2) : null,
    pad: cs ? Math.round(parseFloat(cs.paddingTop)) : null,
    radius: cs ? Math.round(parseFloat(cs.borderTopLeftRadius)) : null,
    leftW: left ? Math.round(left.w) : null,
    leftRatio: left && card ? +(left.w / card.w).toFixed(3) : null,
    cols: gcs ? gcs.gridTemplateColumns.split(' ').map((v) => Math.round(parseFloat(v))) : [],
    colGap: gcs ? Math.round(parseFloat(gcs.columnGap)) : null,
    tabCount: tabs.length,
    tabLabels: tabs.join('/'),
    panels: [...document.querySelectorAll('.fd-panel h4')].map((h) => h.textContent.trim())
  };
});
// 头像降级首字母/缩略图占位是装饰字形，不算正文字号档位
const modalSizes = await fontSizesOf(p, ['.avatar-fallback', '.thumb-empty']);

check('模态宽', `${fm.w}px`, `${FM.modal.w}px`, fm.w != null && Math.abs(fm.w - FM.modal.w) <= 2);
check('模态高', `${fm.h}px`, `${FM.modal.h}px`, fm.h != null && Math.abs(fm.h - FM.modal.h) <= 2);
check('模态水平居中', `${fm.centerDx}px 偏移`, '±2px', fm.centerDx != null && Math.abs(fm.centerDx) <= 2);
check('模态内边距', `${fm.pad}px`, `${FM.modal.padding}px`, fm.pad === FM.modal.padding);
check('模态圆角', `${fm.radius}px`, `${FM.modal.radius}px`, fm.radius === FM.modal.radius);
check('左资料栏宽', `${fm.leftW}px`, `${FM.left_column.w}px`, fm.leftW != null && Math.abs(fm.leftW - FM.left_column.w) <= 2);
check('左栏占比', fm.leftRatio, String(FM.left_column.ratio_of_modal), fm.leftRatio != null && Math.abs(fm.leftRatio - FM.left_column.ratio_of_modal) <= 0.01);
check('双列卡片宽', fm.cols.join('/'), FM.card_columns.map((c) => c.w).join('/'), fm.cols.length === 2 && fm.cols.every((w, i) => Math.abs(w - FM.card_columns[i].w) <= 4));
check('卡片栏距', `${fm.colGap}px`, `${FM.column_gap}px`, fm.colGap === FM.column_gap);
check('模态 tab 数', fm.tabCount, String(FM.tab_count), fm.tabCount === FM.tab_count);
check('模态 tab 名', fm.tabLabels, FM.tab_labels.join('/'), fm.tabLabels === FM.tab_labels.join('/'));
check('信息 tab 四张卡', fm.panels.join('/'), '当前状态/个人资料详情/个人简介/活动摘要', ['当前状态', '个人资料详情', '个人简介', '活动摘要'].every((t) => fm.panels.includes(t)));
check('模态字号档位', modalSizes.join('/'), ALLOWED.join('/'), offSpec(modalSizes).length === 0);
await shot(p, 'friend-modal-1280.png');

await p.keyboard.press('Escape').catch(() => {});
const modalClosed = await p.waitForSelector('.fd-card', { state: 'detached', timeout: 4000 }).then(() => true).catch(() => false);
check('模态 Esc 可关闭', String(modalClosed), 'true', modalClosed);

// ══ 4. 概览 ══
CUR = 'overview';
p = await open('overview', { ready: '.ov-bar' });
await shot(p, 'overview-1440.png');
const ov = await p.evaluate(() => {
  const bars = [...document.querySelectorAll('.ov-bar')];
  const kpi = [...document.querySelectorAll('.ov-num')];
  const barsBox = document.querySelector('.ov-bars');
  return {
    bars: bars.length,
    barsH: barsBox ? Math.round(barsBox.getBoundingClientRect().height) : null,
    barFillInside: bars.every((b) => {
      const f = b.querySelector('.ov-bar-fill');
      return !f || f.getBoundingClientRect().height <= b.getBoundingClientRect().height + 0.5;
    }),
    hbars: document.querySelectorAll('.ov-hbar').length,
    kpiSizes: [...new Set(kpi.map((k) => Math.round(parseFloat(getComputedStyle(k).fontSize))))].sort((a, b) => a - b),
    ranges: [...document.querySelectorAll('.ov-range')].map((r) => r.textContent.trim()),
    tabs: [...document.querySelectorAll('.ov-tab')].map((t) => t.textContent.trim()),
    tabular: [...kpi].every((k) => String(getComputedStyle(k).fontVariantNumeric).includes('tabular'))
  };
});
// 右栏三榜单是独立规格（24/32/22/20/18 档位已在下面逐条断言），不参与正文字号档位
const ovSizes = await fontSizesOf(p, ['.ov-num', '.ov-sec']);
const ovSpec = SPEC.overview;

check('概览每日柱数', ov.bars, `${ovSpec.daily_bars_min}–${ovSpec.daily_bars_max}`, ov.bars >= ovSpec.daily_bars_min && ov.bars <= ovSpec.daily_bars_max);
check('概览柱体不溢出容器', String(ov.barFillInside), 'true', ov.barFillInside === true);
check('活跃时段 24 格', ov.hbars, String(ovSpec.hour_bars), ov.hbars === ovSpec.hour_bars);
check('概览时间档', ov.ranges.join('/'), ovSpec.range_labels.join('/'), ov.ranges.join('/') === ovSpec.range_labels.join('/'));
check('概览 tab', ov.tabs.join('/'), ovSpec.tabs.join('/'), ov.tabs.join('/') === ovSpec.tabs.join('/'));
check('概览字号档位', ovSizes.join('/'), ALLOWED.join('/'), offSpec(ovSizes).length === 0);
check('KPI 大数字档位', ov.kpiSizes.join('/'), `${ovSpec.kpi_px_range[0]}–${ovSpec.kpi_px_range[1]}px`, ov.kpiSizes.length > 0 && ov.kpiSizes.every((s) => s >= ovSpec.kpi_px_range[0] && s <= ovSpec.kpi_px_range[1]));
check('KPI 数字等宽', String(ov.tabular), 'true', ov.tabular === true);

// 右栏三榜单（docs/ref/overview-lists-measure.json）：三节文案 + hero 116 圆头像/32 名字 + 紧凑行 50 头像/22 名字/行距 71
// + 右侧灰条 7 高、槽宽 67、右缩进 25
await p.waitForSelector('[data-list="companions"] .ov-person', { timeout: 15000 }).catch(() => {});
const ovl = await p.evaluate(() => {
  const secs = [...document.querySelectorAll('[data-list]')];
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const px = (el, prop) => (el ? parseFloat(getComputedStyle(el)[prop]) || 0 : null);
  const hero = document.querySelector('[data-list="companions"] .ov-person-hero');
  const heroAvEl = hero?.querySelector('.ov-av');
  const heroAv = r(heroAvEl);
  const titleEl = document.querySelector('[data-list="companions"] .ov-list-title');
  const subEl = document.querySelector('[data-list="companions"] .ov-list-sub');
  const title = r(titleEl);
  const sub = r(subEl);
  const rows = [...document.querySelectorAll('.ov-person:not(.ov-person-hero)')];
  const avs = rows.map((x) => r(x.querySelector('.ov-av'))).filter(Boolean);
  // 行距必须在同一节内量：跨节会把「节间距 + 下一节首行」当成行距
  const secPitch = [...document.querySelectorAll('[data-list]')]
    .map((s) => [...s.querySelectorAll('.ov-person:not(.ov-person-hero) .ov-av')].map((a) => r(a).top))
    .find((tops) => tops.length > 1);
  const pitch = secPitch ? Math.round(secPitch[1] - secPitch[0]) : null;
  const bars = [...document.querySelectorAll('.ov-person-bar')];
  const barEls = bars.map((b) => ({ el: b, box: r(b), zone: r(b.parentElement) }));
  return {
    lists: secs.map((s) => s.dataset.list),
    titles: secs.map((s) => s.querySelector('.ov-list-title')?.textContent.trim() ?? ''),
    heroAv: heroAv ? Math.round(heroAv.width) : null,
    // computed 可能保留百分比（50%），按「≥半径」判断正圆
    heroRound: heroAvEl ? (() => {
      const br = String(getComputedStyle(heroAvEl).borderTopLeftRadius || '');
      const v = parseFloat(br) || 0;
      return br.includes('%') ? v >= 49 : v >= (heroAv?.width ?? 0) / 2 - 1;
    })() : false,
    heroMedia: !!hero?.querySelector('.ov-av img, .ov-av-ch'),
    heroNamePx: hero ? Math.round(px(hero.querySelector('.ov-person-name'), 'fontSize')) : null,
    heroValPx: hero ? Math.round(px(hero.querySelector('.ov-person-val'), 'fontSize')) : null,
    titlePx: Math.round(px(titleEl, 'fontSize') ?? 0),
    subPx: Math.round(px(subEl, 'fontSize') ?? 0),
    subBelowTitle: !!(title && sub && sub.top >= title.bottom - 0.5),
    rowAv: [...new Set(avs.map((b) => Math.round(b.width)))],
    rowNamePx: [...new Set(rows.map((x) => Math.round(px(x.querySelector('.ov-person-name'), 'fontSize') ?? 0)))],
    rowPitch: pitch,
    rowMedia: rows.every((x) => !!x.querySelector('.ov-av img, .ov-av-ch')),
    zoneW: [...new Set(barEls.map((b) => (b.zone ? Math.round(b.zone.width) : 0)))],
    zoneRight: [...new Set(barEls.map((b) => (b.zone ? Math.round(b.zone.right) : 0)))],
    railRight: (() => { const rail = document.querySelector('.ov-rail'); return rail ? Math.round(rail.getBoundingClientRect().right) : null; })(),
    barH: [...new Set(barEls.map((b) => Math.round(b.box?.height ?? 0)))],
    barsInside: barEls.every((b) => b.zone && b.box && b.box.right <= b.zone.right + 0.5 && b.box.width > 0)
  };
});
const ovLists = SPEC.overview.lists ?? {};
const wantLists = (ovLists.panels ?? []).map((x) => x.title);
const heroD = ovLists.hero?.avatar?.d ?? 116;
const rowD = ovLists.row?.avatar_d ?? 50;
const zoneW = ovLists.row?.bar?.zone_w ?? 67;
check('概览右栏三榜单', ovl.lists.join('/'), 'companions/shrinking/passersby', ovl.lists.join('/') === 'companions/shrinking/passersby');
check('概览榜单标题', ovl.titles.join('/'), wantLists.join('/'), ovl.titles.length === 3 && ovl.titles.join('/') === wantLists.join('/'));
check('榜单标题字号', `${ovl.titlePx}px`, `${ovLists.title?.font_px}px`, Math.abs(ovl.titlePx - (ovLists.title?.font_px ?? 24)) <= 1);
check('榜单副标题在标题下方', String(ovl.subBelowTitle), 'true', ovl.subBelowTitle === true);
check('榜单副标题字号', `${ovl.subPx}px`, `${ovLists.subtitle?.font_px}px`, Math.abs(ovl.subPx - (ovLists.subtitle?.font_px ?? 18)) <= 1);
check('榜单首名 hero 头像', `${ovl.heroAv}px`, `${heroD}px 圆形`, ovl.heroAv != null && Math.abs(ovl.heroAv - heroD) <= 2 && ovl.heroRound === true && ovl.heroMedia === true);
check('榜单 hero 名字字号', `${ovl.heroNamePx}px`, `${ovLists.hero?.name?.font_px}px`, Math.abs(ovl.heroNamePx - (ovLists.hero?.name?.font_px ?? 32)) <= 1);
check('榜单 hero 时长字号', `${ovl.heroValPx}px`, `${ovLists.hero?.duration?.font_px}px`, Math.abs(ovl.heroValPx - (ovLists.hero?.duration?.font_px ?? 20)) <= 1);
check('榜单紧凑行头像', ovl.rowAv.join('/') || '-', `${rowD}px`, ovl.rowAv.length > 0 && ovl.rowAv.every((w) => Math.abs(w - rowD) <= 2));
check('榜单紧凑行名字字号', ovl.rowNamePx.join('/') || '-', `${ovLists.row?.name_font_px}px`, ovl.rowNamePx.length > 0 && ovl.rowNamePx.every((w) => Math.abs(w - (ovLists.row?.name_font_px ?? 22)) <= 1));
check('榜单行距', `${ovl.rowPitch}px`, `${ovLists.row?.pitch}px`, ovl.rowPitch != null && Math.abs(ovl.rowPitch - (ovLists.row?.pitch ?? 71)) <= 2);
check('榜单行都有头像槽', String(ovl.rowMedia), 'true', ovl.rowMedia === true);
check('榜单相对条右槽宽', ovl.zoneW.join('/') || '-', `${zoneW}px`, ovl.zoneW.length > 0 && ovl.zoneW.every((w) => Math.abs(w - zoneW) <= 1));
check('榜单相对条右缩进', ovl.railRight != null && ovl.zoneRight.length ? String(ovl.railRight - ovl.zoneRight[0]) + 'px' : '-', `${ovLists.section?.bar_right_inset ?? 25}px`, ovl.railRight != null && ovl.zoneRight.length > 0 && Math.abs(ovl.railRight - ovl.zoneRight[0] - (ovLists.section?.bar_right_inset ?? 25)) <= 1);
check('榜单相对条高', ovl.barH.join('/') || '-', `${ovLists.row?.bar?.h}px`, ovl.barH.length > 0 && ovl.barH.every((h) => Math.abs(h - (ovLists.row?.bar?.h ?? 7)) <= 1));
check('榜单相对条不溢出右槽', String(ovl.barsInside), 'true', ovl.barsInside === true);

// 182 旅程：按月折叠，默认只开最新月，月头可开关，日行可点开逐次停留
await p.locator('.ov-tab', { hasText: '旅程' }).click({ timeout: 8000 }).catch(() => {});
await p.waitForSelector('[data-journey="months"]', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(700);
const jm = await p.evaluate(() => {
  const secs = [...document.querySelectorAll('[data-journey="months"] section[data-month]')];
  const open = secs.filter((s) => s.dataset.monthOpen === 'true');
  const dayRows = open.reduce((n, s) => n + s.querySelectorAll('.jm-day').length, 0);
  const closedRows = secs.filter((s) => s.dataset.monthOpen !== 'true')
    .reduce((n, s) => n + s.querySelectorAll('.jm-day').length, 0);
  const bars = [...document.querySelectorAll('.jm-daybar')].map((b) => {
    const f = b.firstElementChild;
    return f ? f.getBoundingClientRect().width <= b.getBoundingClientRect().width + 0.5 : true;
  });
  return {
    months: secs.length,
    open: open.length,
    dayRows,
    closedRows,
    barInside: bars.every(Boolean),
    heads: [...document.querySelectorAll('.jm-head-toggle')].map((b) => {
      const m = b.textContent.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
      return m ? `${m[1]}-${m[2]}` : b.textContent.trim().slice(0, 12);
    })
  };
});
check('旅程按月分组', `${jm.months} 个月`, '≥1', jm.months >= 1);
check('旅程默认只开最新月', `${jm.open}/${jm.months} 展开`, jm.months > 1 ? '1' : String(jm.months), jm.months > 1 ? jm.open === 1 : jm.open === jm.months);
check('折叠月不渲染日行', String(jm.closedRows), '0', jm.closedRows === 0);
check('展开月有日行', String(jm.dayRows), '≥1', jm.dayRows >= 1);
check('旅程日柱不溢出', String(jm.barInside), 'true', jm.barInside);
check('月头是「YYYY 年 M 月」', jm.heads.join('/'), 'YYYY-M', jm.heads.length > 0 && jm.heads.every((h) => /^\d{4}-\d{1,2}$/.test(h)));

if (jm.months >= 2) {
  const toggles = p.locator('.jm-head-toggle');
  await toggles.nth(1).click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(350);
  const expanded = await p.evaluate(() => document.querySelectorAll('[data-month-open="true"]').length);
  await toggles.nth(1).click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(350);
  const collapsed = await p.evaluate(() => document.querySelectorAll('[data-month-open="true"]').length);
  check('月份头点开/再点收起', `展开 ${expanded} 月 → ${collapsed} 月`, '2 → 1', expanded === 2 && collapsed === 1);
} else {
  check('月份头点开/再点收起', '演示数据只有一个月', '跳过', true);
}

const dayOpened = await p.evaluate(async () => {
  const row = document.querySelector('.jm-dayrow');
  if (!row) return 0;
  row.click();
  await new Promise((r) => setTimeout(r, 300));
  return document.querySelectorAll('.jm-visits .ov-jrow').length;
});
check('点一天展开逐次停留', `${dayOpened} 行`, '≥1', dayOpened >= 1);
await shot(p, 'overview-journey-1440.png');

// ══ 5. 世界库 ══
CUR = 'worlds';
p = await open('worlds', { ready: '.world-card' });
await shot(p, 'worlds-1440.png');
const wo = await p.evaluate(() => {
  const grid = document.querySelector('.world-grid');
  const card = document.querySelector('.world-card');
  const thumb = document.querySelector('.world-card .thumb');
  const head = document.querySelector('.world-head');
  const cs = card ? getComputedStyle(card) : null;
  const tb = thumb ? thumb.getBoundingClientRect() : null;
  const tcs = thumb ? getComputedStyle(thumb) : null;
  const name = document.querySelector('.world-card .wc-name');
  const nb = name ? name.getBoundingClientRect() : null;
  const meta = document.querySelector('.world-card .wc-meta');
  const mb = meta ? meta.getBoundingClientRect() : null;
  const cb = card ? card.getBoundingClientRect() : null;
  return {
    cards: document.querySelectorAll('.world-card').length,
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null,
    cardRadius: cs ? parseFloat(cs.borderTopLeftRadius) : null,
    cardBorder: cs ? cs.borderTopWidth : null,
    thumbRadius: tcs ? tcs.borderTopLeftRadius : null,
    colGap: grid ? Math.round(parseFloat(getComputedStyle(grid).columnGap)) : null,
    padX: nb && cb ? Math.round(nb.left - cb.left) : null,
    metaRows: document.querySelectorAll('.world-card:first-child .wc-meta').length,
    metaGap: nb && mb ? Math.round(mb.top - nb.bottom) : null,
    thumbAspect: tb && tb.height ? +(tb.width / tb.height).toFixed(2) : null,
    headCols: head ? head.children.length : null,
    headH: head ? Math.round(head.getBoundingClientRect().height) : null
  };
});
const woSizes = await fontSizesOf(p, ['.thumb-empty']); // 缩略图占位字形单列在 decor 档
const woDecor = await p.evaluate(() => {
  const el = document.querySelector('.world-card .thumb-empty');
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
});
const woSpec = SPEC.worlds;

check('世界库网格列数', wo.cols, String(woSpec.grid_columns), wo.cols === woSpec.grid_columns);
check('世界卡片数', wo.cards, `≥${woSpec.min_cards}`, wo.cards >= woSpec.min_cards);
check('世界缩略图比例', `1:${wo.thumbAspect ? (1 / wo.thumbAspect).toFixed(2) : null}`, `≈4:3 (${woSpec.thumb_aspect})`, wo.thumbAspect != null && Math.abs(wo.thumbAspect - woSpec.thumb_aspect) <= 0.05);
check('世界表头列数', wo.headCols, String(woSpec.head_columns), wo.headCols === woSpec.head_columns);
check('世界表头行高', `${wo.headH}px`, '≤32px', wo.headH != null && wo.headH <= 32);
check('缩略图圆角', wo.thumbRadius, `${woSpec.thumb_radius}px`, wo.thumbRadius === `${woSpec.thumb_radius}px`);
check('卡片无描边无底', `border ${wo.cardBorder} / 圆角 ${wo.cardRadius}px`, 'border 0px / 圆角 0px', wo.cardBorder === '0px' && wo.cardRadius === 0);
check('世界卡片列距', `${wo.colGap}px`, `${woSpec.col_gap}px`, wo.colGap === woSpec.col_gap);
check('世界卡片文字左缩进', `${wo.padX}px`, `${woSpec.pad_x}px`, wo.padX === woSpec.pad_x);
check('世界卡片元信息行数', wo.metaRows, `${woSpec.meta_lines} 行`, wo.metaRows === woSpec.meta_lines);
check('世界卡片标题到元信息', `${wo.metaGap}px`, `${woSpec.meta_from_title}px`, wo.metaGap === woSpec.meta_from_title);
check('世界库字号档位', woSizes.join('/'), ALLOWED.join('/'), offSpec(woSizes).length === 0);
check('缩略图占位字号', `${woDecor}px`, `${woSpec.decor_px_range?.[0]}–${woSpec.decor_px_range?.[1]}px(装饰档)`, woDecor == null || (woDecor >= 16 && woDecor <= 20));

// ══ 6. 通知 ══
CUR = 'notifications';
p = await open('notifications');
await p.waitForTimeout(1200);
await shot(p, 'notifications-1440.png');
const nt = await p.evaluate(() => {
  const card = document.querySelector('.card');
  const cs = card ? getComputedStyle(card) : null;
  const chips = [...document.querySelectorAll('.chip')].map((c) => c.textContent.trim());
  return {
    cards: document.querySelectorAll('.card').length,
    chips: document.querySelectorAll('.chip').length,
    chipLabels: chips.slice(0, 8).join('/'),
    active: [...document.querySelectorAll('.chip[data-active="true"]')].map((c) => c.textContent.trim()),
    labels: document.querySelectorAll('.label-xs').length,
    cardRadius: cs ? parseFloat(cs.borderTopLeftRadius) : null,
    cardBorder: cs ? cs.borderTopWidth : null,
    placeholder: (document.body.innerText || '').includes('加载中')
  };
});
const ntSizes = await fontSizesOf(p);
const ntSpec = SPEC.notifications;

check('通知卡片数', nt.cards, '≥1', nt.cards >= 1);
check('通知筛选 chip', nt.chips, `≥${ntSpec.min_chips}`, nt.chips >= ntSpec.min_chips);
check('通知默认筛选', nt.active.join('/'), ntSpec.default_filters.join('/'), ntSpec.default_filters.every((f) => nt.active.includes(f)));
check('通知类型标签数', nt.labels, '≥1', nt.labels >= 1);
check('通知卡片圆角', `${nt.cardRadius}px`, `${ntSpec.card_radius}px`, nt.cardRadius === ntSpec.card_radius);
check('通知卡片描边', nt.cardBorder, ntSpec.card_border, nt.cardBorder === ntSpec.card_border);
check('通知字号档位', ntSizes.join('/'), ALLOWED.join('/'), offSpec(ntSizes).length === 0);
check('通知无「加载中」残留', String(nt.placeholder), 'false', nt.placeholder === false);

// ══ 7. 响应式：每页 390px 无横向溢出 + 截图 ══
for (const [page, name, ready] of [
  ['friends', 'friends', '.friend-row:not(.list-head), .card'],
  ['overview', 'overview', '.ov-bar'],
  ['worlds', 'worlds', '.world-card'],
  ['notifications', 'notifications', '.card']
]) {
  CUR = `${page}@390`;
  const mp = await open(page, { width: 390, height: 844, fresh: true, ready });
  const overflow = await overflowOf(mp);
  check(`${page} 390px 无横向溢出`, String(overflow), 'false', overflow === false);
  await shot(mp, `${name}-390.png`);
  await mp.close().catch(() => {});
}

// 桌面超宽档（3840）只看主页面
CUR = 'friends@3840';
const wide = await open('friends', { width: 3840, height: 2160, fresh: true, ready: '.friend-row:not(.list-head)' });
const wideOverflow = await overflowOf(wide);
check('3840px 无横向溢出', String(wideOverflow), 'false', wideOverflow === false);
await shot(wide, 'friends-3840.png');
await wide.close().catch(() => {});

await p.close().catch(() => {});

// ══ 8. 全页面三端截图 + 通用视觉体检（覆盖 App 里每一个页面） ══
// 完成定义要求「每个页面」都有三端截图、字号档位来自 spec.typography。
// 这里对每页在 1440/390/3840 各截一张（<page>-desktop.png / -mobile.png / -4k.png），
// 顺带核对正文无横向溢出、字号不越过 spec 允许档位。
const ALL_PAGES = [
  'overview', 'search', 'friends', 'feed', 'notifications', 'sessions', 'players',
  'moderation', 'encounters', 'stats', 'favorites', 'insights', 'worlds', 'calendar',
  'friendlist', 'friendlog', 'gamelog', 'settings'
];
// 装饰字形（头像首字、缩略图占位、KPI 大数字）不参与正文字号档位
const DECOR = ['.avatar-fallback', '.thumb-empty', '.ov-num', '.kpi-num', '[class*="num-"]', '.ov-sec'];
const shotPages = [];
for (const page of ALL_PAGES) {
  for (const [tag, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844], ['4k', 3840, 2160]]) {
    CUR = `${page}@${width}`;
    const gp = await open(page, { width, height, fresh: true });
    const overflow = await overflowOf(gp);
    check(`${page} ${width}px 无横向溢出`, String(overflow), 'false', overflow === false);
    if (tag === 'desktop') {
      const sizes = await fontSizesOf(gp, DECOR);
      check(`${page} 字号档位`, sizes.join('/'), ALLOWED.join('/'), offSpec(sizes).length === 0);
    }
    await shot(gp, `${page}-${tag}.png`);
    await gp.close().catch(() => {});
  }
  shotPages.push(page);
}

// ══ 9. 逐页结构断言：spec.pages[*].structure（全部来自真机截图量测）→ 我们的 DOM ══
// 断言实现在 scripts/lib/page_structure.mjs，与 structure_parity.mjs 共用同一套口径。
/** 结构测量要避开「还在加载」：等内容落位，空内容/零行时空白重载一次再量 */
async function openStruct(page, want = {}) {
  const sp = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
  const settle = async () => {
    await sp.waitForFunction(() => {
      const m = document.querySelector('.workspace') || document.querySelector('main');
      if (!m || m.innerText.trim().length <= 20) return false;
      if (/^\s*加载中/.test(m.innerText)) return false;
      return !m.querySelector('.skeleton, [class*=skeleton]');
    }, null, { timeout: 20000 }).catch(() => {});
    await sp.waitForTimeout(1200);
  };
  await gotoVrc(sp, `${PAGE}#/${page}`);
  await settle();
  let got = await probeMain(sp);
  for (let i = 0; i < 2 && got.text.trim().length < 40; i += 1) {
    await sp.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await settle();
    got = await probeMain(sp);
  }
  if (want.rows_visible && got.rows === 0) {
    await sp.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await settle();
    got = await probeMain(sp);
  }
  return [sp, got];
}

for (const page of STRUCT_PAGES) {
  CUR = page;
  const want = SPEC.pages?.[page]?.structure;
  if (!want) continue;
  const w = dataDependentWant(page, want, roster);
  const [sp, got] = await openStruct(page, w);
  rows.push(...structureRows(page, got, w, SPEC.pages?.[page]?.row_pitch).map((r) => ({ ...r, key: page })));
  await sp.close().catch(() => {});
}

// 外壳断言（chrome-parity.json，24 项全部来自真机截图量测）对每一页都成立，计入每页分母
const chromeFile = path.join(ROOT, 'docs/ref/chrome-parity.json');
const chromeRows = fs.existsSync(chromeFile)
  ? (JSON.parse(fs.readFileSync(chromeFile, 'utf8')).rows || [])
    .map((r) => ({ name: `外壳 ${r.metric}`, ours: String(r.ours), want: String(r.ref), ok: !!r.ok }))
  : [];
// VRCX-0 没有对应页面（ref_coverage.py 的 NA 结论）：没有真机结构可对，只要求三端截图
const NA_PAGES = {
  stats: 'VRCX-0 #/charts 重定向到 #/charts/mutual（与 insights 同页），无独立统计页',
  calendar: 'VRCX-0 无 calendar 路由（capture_ref_cdp.mjs 实截落回 /feed）'
};

const pageScores = {};
for (const key of [...new Set(rows.map((r) => r.key))]) {
  const own = rows.filter((r) => r.key === key);
  const all = [...own, ...chromeRows];
  const ok = all.filter((r) => r.ok).length;
  pageScores[key] = {
    pass: ok,
    total: all.length,
    score: Math.round((ok / all.length) * 100),
    na: NA_PAGES[key] || null,
    diff: all.filter((r) => !r.ok).map((r) => r.name)
  };
}

const pass = rows.filter((r) => r.ok).length;
const score = Math.round((pass / rows.length) * 100);
for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'DIFF'}  ${r.name} — 我们 ${r.ours} / 基准 ${r.want}`);
}
const pages = ['好友位置', '动态', '好友详情模态', '概览', '世界库', '通知'];
// 有自有结构断言（不止外壳/通用体检）的页面
const deep = Object.entries(pageScores).filter(([, v]) => v.total > chromeRows.length + 2).map(([k]) => k);
// 覆盖清单给 ref_coverage.py 读（哪些页面已经有截图量测来的断言）
fs.writeFileSync(path.join(ROOT, 'docs/ref/visual-parity.json'), JSON.stringify({
  _note: '由 scripts/visual_parity.mjs 生成：spec 基准 vs 我们的 DOM/截图；page_scores=每页自有断言+外壳断言',
  at: new Date().toISOString(),
  base: BASE,
  pages: Object.keys(pageScores),
  asserted: deep,
  page_scores: pageScores,
  shots: shotPages,
  chrome_rows: chromeRows.length,
  pass, total: rows.length, score,
  rows
}, null, 2));

console.log('\n按页相似度（自有断言 + 外壳断言，基准全部来自 docs/ref 真机截图量测）:');
for (const [k, v] of Object.entries(pageScores)) {
  const tag = v.na ? `n/a(${v.na.slice(0, 18)}…)` : v.score >= 95 ? '≥95%' : '未达标';
  console.log(`  ${k.padEnd(12)} ${String(v.score).padStart(3)}%  ${v.pass}/${v.total}  ${tag}${v.diff.length ? `  DIFF:${v.diff.join(',')}` : ''}`);
}
const short = Object.entries(pageScores).filter(([, v]) => !v.na && v.score < 95);
console.log(`\n视觉相似度 ${score}%（${pass}/${rows.length} 项对齐；自有结构断言 ${deep.length} 页：${deep.join('/')}；三端截图 ${shotPages.length} 页）· 截图在 docs/screenshots/compare/`);
if (short.length) console.log(`未达 95% 的页面：${short.map(([k, v]) => `${k}=${v.score}%`).join(' ')}`);
await browser.close();
process.exit(pass === rows.length && short.length === 0 ? 0 : 1);
