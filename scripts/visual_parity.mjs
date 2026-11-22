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
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8790';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const OUT = path.join(ROOT, 'docs/screenshots/compare');
fs.mkdirSync(OUT, { recursive: true });

const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const ALLOWED = SPEC.typography.px_sizes_allowed;
const rows = [];
const check = (name, ours, want, ok) => {
  rows.push({ name, ours, want, ok });
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

let tab = null; // 当前复用的 page（1440 档），换宽度就重开

/** 开页：hash 直达（App 有 hashchange 监听），等首屏有内容再截图 */
async function open(pageName, { width = 1440, height = 960, fresh = false, ready } = {}) {
  if (!tab || tab.isClosed() || fresh || tab.viewportSize().width !== width) {
    if (tab) await tab.close().catch(() => {});
    tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  }
  await tab.goto(`${BASE}#/${pageName}`, { waitUntil: 'networkidle', timeout: 60000 });
  if (ready) await tab.waitForSelector(ready, { timeout: 25000 }).catch(() => {});
  await tab.waitForTimeout(1200);
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
let p = await open('friends', { ready: '.friend-row:not(.list-head), .card' });
await shot(p, 'friends-1440.png');

const measured = await p.evaluate(() => {
  const row = document.querySelector('.friend-row:not(.list-head)');
  const avatar = document.querySelector('.friend-row:not(.list-head) .avatar');
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

check('好友行高', `${measured.rowHeight}px`, '32–40px', measured.rowHeight != null && measured.rowHeight <= 40);
check('头像尺寸', `${measured.avatarSize}px`, '≈56px(大方块)/40px(列表)', measured.avatarSize != null && measured.avatarSize >= 22);
check('行无边框底色', `${measured.rowBorder}/${measured.rowBg}`, '0px / transparent', measured.rowBorder === '0px');
check('字号档位', friendSizes.join('/'), ALLOWED.join('/'), offSpec(friendSizes).length === 0);
check('数字等宽', measured.tabular, 'tabular-nums', String(measured.tabular).includes('tabular'));

// ══ 2. 动态页（表格四列） ══
await open('feed', { ready: 'thead th' });
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

// ══ 3. 好友抽屉（回好友位置页点第一行） ══
await open('friends', { ready: '.friend-row:not(.list-head)' });
await p.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true }).catch(() => {});
await p.waitForSelector('.drawer-avatar', { timeout: 12000 }).catch(() => {});
await p.waitForTimeout(600);
const drawer = await p.evaluate(() => {
  const av = document.querySelector('.drawer-avatar, .drawer-head .avatar');
  // tab 名要干净：徽章数字（概览309）不算名字
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.replace(/\d+/g, '').trim());
  const head = document.querySelector('.drawer-head');
  return {
    avatar: av ? Math.round(av.getBoundingClientRect().width) : null,
    tabs: tabs.length,
    tabLabels: tabs.join('/'),
    hasBadge: !!document.querySelector('.badge, .chip[data-tone]'),
    headerPx: head ? parseFloat(getComputedStyle(head).fontSize) : null
  };
});
const drawerSizes = await fontSizesOf(p);

check('抽屉头像', `${drawer.avatar}px`, '≥72px', drawer.avatar != null && drawer.avatar >= 72);
check('抽屉 tab 数', drawer.tabs, String(SPEC.user_dialog.tab_count), drawer.tabs === SPEC.user_dialog.tab_count);
check('抽屉 tab 名', drawer.tabLabels, SPEC.user_dialog.tab_labels.join('/'), drawer.tabLabels === SPEC.user_dialog.tab_labels.join('/'));
check('抽屉字号档位', drawerSizes.join('/'), ALLOWED.join('/'), offSpec(drawerSizes).length === 0);
await shot(p, 'drawer-1440.png');
await p.keyboard.press('Escape').catch(() => {});

// ══ 4. 概览 ══
await open('overview', { ready: '.ov-bar' });
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
const ovSizes = await fontSizesOf(p, ['.ov-num']);
const ovSpec = SPEC.overview;

check('概览每日柱数', ov.bars, `${ovSpec.daily_bars_min}–${ovSpec.daily_bars_max}`, ov.bars >= ovSpec.daily_bars_min && ov.bars <= ovSpec.daily_bars_max);
check('概览柱体不溢出容器', String(ov.barFillInside), 'true', ov.barFillInside === true);
check('活跃时段 24 格', ov.hbars, String(ovSpec.hour_bars), ov.hbars === ovSpec.hour_bars);
check('概览时间档', ov.ranges.join('/'), ovSpec.range_labels.join('/'), ov.ranges.join('/') === ovSpec.range_labels.join('/'));
check('概览 tab', ov.tabs.join('/'), ovSpec.tabs.join('/'), ov.tabs.join('/') === ovSpec.tabs.join('/'));
check('概览字号档位', ovSizes.join('/'), ALLOWED.join('/'), offSpec(ovSizes).length === 0);
check('KPI 大数字档位', ov.kpiSizes.join('/'), `${ovSpec.kpi_px_range[0]}–${ovSpec.kpi_px_range[1]}px`, ov.kpiSizes.length > 0 && ov.kpiSizes.every((s) => s >= ovSpec.kpi_px_range[0] && s <= ovSpec.kpi_px_range[1]));
check('KPI 数字等宽', String(ov.tabular), 'true', ov.tabular === true);

// ══ 5. 世界库 ══
await open('worlds', { ready: '.world-card' });
await shot(p, 'worlds-1440.png');
const wo = await p.evaluate(() => {
  const grid = document.querySelector('.world-grid');
  const card = document.querySelector('.world-card');
  const thumb = document.querySelector('.world-card .thumb');
  const head = document.querySelector('.world-head');
  const cs = card ? getComputedStyle(card) : null;
  const tb = thumb ? thumb.getBoundingClientRect() : null;
  return {
    cards: document.querySelectorAll('.world-card').length,
    cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null,
    cardRadius: cs ? parseFloat(cs.borderTopLeftRadius) : null,
    cardBorder: cs ? cs.borderTopWidth : null,
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
check('世界缩略图比例', `1:${wo.thumbAspect ? (1 / wo.thumbAspect).toFixed(2) : null}`, `≈16:9 (${woSpec.thumb_aspect})`, wo.thumbAspect != null && Math.abs(wo.thumbAspect - woSpec.thumb_aspect) <= 0.05);
check('世界表头列数', wo.headCols, String(woSpec.head_columns), wo.headCols === woSpec.head_columns);
check('世界表头行高', `${wo.headH}px`, '≤32px', wo.headH != null && wo.headH <= 32);
check('卡片圆角', `${wo.cardRadius}px`, `${SPEC.tokens.radius}px`, wo.cardRadius === SPEC.tokens.radius);
check('卡片描边', wo.cardBorder, '1px', wo.cardBorder === '1px');
check('世界库字号档位', woSizes.join('/'), ALLOWED.join('/'), offSpec(woSizes).length === 0);
check('缩略图占位字号', `${woDecor}px`, `${woSpec.decor_px_range?.[0]}–${woSpec.decor_px_range?.[1]}px(装饰档)`, woDecor == null || (woDecor >= 16 && woDecor <= 20));

// ══ 6. 通知 ══
await open('notifications');
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
  const mp = await open(page, { width: 390, height: 844, fresh: true, ready });
  const overflow = await overflowOf(mp);
  check(`${page} 390px 无横向溢出`, String(overflow), 'false', overflow === false);
  await shot(mp, `${name}-390.png`);
  await mp.close().catch(() => {});
}

// 桌面超宽档（3840）只看主页面
const wide = await open('friends', { width: 3840, height: 2160, fresh: true, ready: '.friend-row:not(.list-head)' });
const wideOverflow = await overflowOf(wide);
check('3840px 无横向溢出', String(wideOverflow), 'false', wideOverflow === false);
await shot(wide, 'friends-3840.png');
await wide.close().catch(() => {});

await p.close().catch(() => {});
await browser.close();

const pass = rows.filter((r) => r.ok).length;
const score = Math.round((pass / rows.length) * 100);
for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'DIFF'}  ${r.name} — 我们 ${r.ours} / 基准 ${r.want}`);
}
const pages = ['好友位置', '动态', '好友抽屉', '概览', '世界库', '通知'];
console.log(`\n视觉相似度 ${score}%（${pass}/${rows.length} 项对齐，覆盖 ${pages.length} 页：${pages.join('/')}）· 截图在 docs/screenshots/compare/`);
process.exit(pass === rows.length ? 0 : 1);
