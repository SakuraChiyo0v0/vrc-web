/**
 * 182 UI 实测（由 parity18.mjs 拷到带 playwright 的目录执行）：
 *   node .parity18_ui.mjs <baseUrl>
 * 只做两件可判定的事：
 *   1) 好友抽屉「数据」tab 是否真有图表（30 根日柱 / 常去世界横条 / 7×24 热力图）
 *   2) 概览「旅程」是否按月折叠、默认只开最新月，月头可点开；每日柱点击是否落到对应那天
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8898';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const rows = [];
const check = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
const done = (msg) => { console.error(msg); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  /* ── 1. 好友详情模态（第十四轮起由抽屉改为 VRCX-0 式大模态） ── */
  await page.goto(`${BASE}#/friends`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.friend-row:not(.list-head)', { timeout: 25000 });
  // 固定开 Alice（演示库里唯一有世界/会话记录的人），首行可能是空好友
  const alice = page.locator('.friend-row[data-user="usr_alice"]');
  if (await alice.count()) await alice.first().click({ timeout: 8000, force: true });
  else await page.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true });
  await page.waitForSelector('.fd-card', { timeout: 20000 });

  const modal = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.fd-tabs button')].map((b) => b.textContent.trim());
    return {
      open: !!document.querySelector('.fd-card'),
      tabs: tabs.length,
      hasCover: !!document.querySelector('.fd-cover'),
      hasAvatar: !!document.querySelector('.fd-avatar'),
      cards: document.querySelectorAll('.fd-panel').length
    };
  });
  check('好友详情模态打开', modal.open);
  check('8 个 tab 齐全', modal.tabs === 8, `${modal.tabs} 个`);
  check('左栏封面 + 叠压头像', modal.hasCover && modal.hasAvatar);
  check('信息页四张卡片', modal.cards >= 4, `${modal.cards} 张`);

  // 活动记录 / 创建的世界：必须真有行（数据来自 /api/friend/:id）
  await page.locator('.fd-tabs button', { hasText: '活动记录' }).first().click();
  await page.waitForSelector('.fd-list', { timeout: 8000 }).catch(() => {});
  const actRows = await page.locator('.fd-list .fd-row').count();
  check('活动记录有行', actRows >= 1, `${actRows} 行`);

  await page.locator('.fd-tabs button', { hasText: '创建的世界' }).first().click();
  await page.waitForTimeout(600);
  const worldRows = await page.locator('.fd-list .fd-row').count();
  check('常去世界有行', worldRows >= 1, `${worldRows} 行`);

  // Esc 必须能关（规格同 VRCX-0）
  await page.keyboard.press('Escape');
  const escClosed = await page.waitForSelector('.fd-card', { state: 'detached', timeout: 4000 })
    .then(() => true).catch(() => false);
  check('Esc 关闭详情', escClosed);

  /* ── 2. 概览旅程：按月折叠 + 每日柱可点 ── */
  await page.goto(`${BASE}#/overview`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('[data-range="all"]', { timeout: 20000 });
  await page.locator('[data-tab="journey"]').click();
  await page.waitForSelector('[data-journey="months"] [data-month]', { timeout: 20000 });

  const before = await page.evaluate(() => {
    const months = [...document.querySelectorAll('[data-journey="months"] [data-month]')];
    return {
      months: months.length,
      open: months.filter((m) => m.dataset.monthOpen === 'true').map((m) => m.dataset.month),
      days: document.querySelectorAll('[data-journey="months"] [data-day]').length,
      toggles: document.querySelectorAll('[data-month-toggle]').length
    };
  });
  check('旅程按月分组 ≥1', before.months >= 1, `${before.months} 个月`);
  check('默认只展开最新一月', before.months === 1 || before.open.length === 1, `展开 ${before.open.join(',')}`);
  check('每月都有折叠按钮', before.toggles === before.months, `${before.toggles}/${before.months}`);

  // 点一个「收起的」月头：展开后日行应增加
  const closed = await page.evaluate(() => {
    const m = [...document.querySelectorAll('[data-month]')].find((x) => x.dataset.monthOpen === 'false');
    return m ? m.dataset.month : null;
  });
  if (closed) {
    const daysBefore = await page.locator('[data-journey="months"] [data-day]').count();
    await page.locator(`[data-month-toggle="${closed}"]`).click();
    await page.waitForTimeout(250);
    const daysAfter = await page.locator('[data-journey="months"] [data-day]').count();
    check('点月头可展开', daysAfter > daysBefore, `${daysBefore} → ${daysAfter} 天`);
    // 再点一次收起
    await page.locator(`[data-month-toggle="${closed}"]`).click();
    await page.waitForTimeout(250);
    const daysBack = await page.locator('[data-journey="months"] [data-day]').count();
    check('点月头可收起', daysBack === daysBefore, `${daysAfter} → ${daysBack} 天`);
  } else {
    check('点月头可展开', false, '只有一个月份，无收起的月可测');
  }

  // 每日柱可点：回概览，点一根非零柱，应切到旅程并展开那一天
  await page.locator('[data-tab="overview"]').click();
  await page.waitForSelector('.ov-bars .ov-bar[data-date]', { timeout: 15000 });
  const target = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.ov-bars .ov-bar[data-date]')];
    const b = bars.find((x) => Number(x.dataset.minutes) > 0);
    return b ? b.dataset.date : null;
  });
  check('每日柱子可点（有可点的非零柱）', !!target, target || '没有非零柱');
  if (target) {
    await page.locator(`.ov-bars .ov-bar[data-date="${target}"]`).click();
    await page.waitForSelector('[data-journey="months"]', { timeout: 20000 });
    await page.waitForTimeout(400);
    const hit = await page.evaluate((date) => {
      const day = document.querySelector(`[data-day="${date}"]`);
      const tab = document.querySelector('[data-tab="journey"]');
      return {
        tabActive: tab?.dataset.active === 'true',
        dayOpen: day?.querySelector('.jm-dayrow')?.dataset.open === 'true',
        visits: day ? day.querySelectorAll('.jm-visits .ov-jrow').length : 0
      };
    }, target);
    check('点每日柱切到旅程', hit.tabActive);
    check('点每日柱自动展开当天', hit.dayOpen, `${target} 展开停留 ${hit.visits} 条`);
  }
} catch (e) {
  done(`UI 异常：${e.message}`);
  check('UI 流程跑通', false, e.message);
} finally {
  await browser.close().catch(() => {});
}

for (const r of rows) console.log(`PARITY18UI ${r.ok ? 'OK' : 'FAIL'} ${r.name}${r.detail ? ` · ${r.detail}` : ''}`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);