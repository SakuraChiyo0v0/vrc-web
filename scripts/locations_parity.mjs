/**
 * 好友位置页分栏复刻对齐：`#/friends` 的「按世界实例分栏」vs 真机 docs/ref/vrcx0-locations.png。
 *
 *   node scripts/locations_parity.mjs [baseUrl]      # 默认 http://127.0.0.1:8891
 *   LOC_NEG=1 node scripts/locations_parity.mjs      # 反向自检：注入坏几何，必须被抓到
 *
 * grid_parity 只数「每行几列」，structure_parity 只看列头。这里钉死分栏语义本身：
 *   栏序（世界 → 好友收藏 → 其他在线 → 私人房间 → 离线）、组头人数徽标 = 卡数、
 *   世界栏 ≥2 人且同实例、私人房间只收在线且不显示世界行、离线垫底、
 *   每个人只出现一次不丢不重、组头不重复区域码（JPJP）、卡片几何（96 高 / 56 正圆 / 6 列）、
 *   列表视图与网格视图分组一致。
 * 每项 PASS/DIFF；有 DIFF exit 1，明细写 docs/ref/locations-parity.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891').replace(/\/$/, '');
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8')).friends_locations;
const OUT = path.join(ROOT, 'docs/ref/locations-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const VIEWPORT = { width: 1688, height: 1028 };   // 真机量测同一内窗

const ORDER = ['world', 'favorite', 'others', 'private', 'offline'];
const NEG = process.env.LOC_NEG === '1';

const rows = [];
const check = (name, got, want, ok, extra = '') => {
  rows.push({ name, got: String(got), want: String(want), ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'DIFF'}  ${name}  我们=${got}  真机=${want}${extra ? `  (${extra})` : ''}`);
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
// 每次干净起：localStorage 里的 friends:tab / friends:view 会把断言带偏。
// 用 sessionStorage 打标只清一次——折叠记忆要跨 reload 验，reload 时不能再清。
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__loc_cleared')) {
      localStorage.clear();
      sessionStorage.setItem('__loc_cleared', '1');
    }
  } catch {}
});

let exitCode = 0;
const readGroups = () => page.evaluate(() => {
  const cs = (el) => getComputedStyle(el);
  const groups = [...document.querySelectorAll('.loc-groups .loc-group')].map((g) => {
    const cards = [...g.querySelectorAll('.loc-card')];
    return {
      type: g.getAttribute('data-group'),
      key: g.getAttribute('data-group-key'),
      title: (g.querySelector('.loc-title')?.textContent || '').trim(),
      code: (g.querySelector('.loc-code')?.textContent || '').trim(),
      badge: (g.querySelector('.loc-count')?.textContent || '').trim(),
      cards: cards.map((c) => ({
        u: c.getAttribute('data-user'),
        on: c.getAttribute('data-online'),
        hasWorldLine: !!c.querySelector('.loc-world'),
        h: Math.round(c.getBoundingClientRect().height),
        avatar: (() => {
          const a = c.querySelector('.avatar');
          if (!a) return null;
          const r = a.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), radius: cs(a).borderRadius };
        })()
      }))
    };
  });
  const grid = document.querySelector('.loc-groups');
  return {
    groups,
    cols: grid ? cs(grid.querySelector('.loc-grid') || grid).gridTemplateColumns.split(' ').length : 0,
    view: document.querySelector('.loc-groups')?.getAttribute('data-view') || null
  };
});

try {
  const api = await fetch(`${BASE}/api/roster`).catch((e) => ({ ok: false, err: e }));
  if (!api.ok) throw new Error(`服务不可用：${BASE}/api/roster ${api.status ?? api.err}`);
  const roster = await api.json();
  if (typeof roster?.total !== 'number' || !Array.isArray(roster?.friends)) {
    throw new Error(`${BASE}/api/roster 缺 total/friends，可能打到了 SPA 兜底页`);
  }
  const byId = new Map(roster.friends.map((f) => [f.user_id, f]));
  const onlineIds = new Set(roster.friends.filter((f) => f.online).map((f) => f.user_id));
  const offlineIds = new Set(roster.friends.filter((f) => !f.online).map((f) => f.user_id));

  await page.goto(`${BASE}/#/friends`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 等分栏稳定：卡片数两次读数一致且等于接口在线人数（接口回来前会是 0 或半截）
  let prev = null;
  for (let i = 0; i < 60; i += 1) {
    const n = await page.evaluate(() => document.querySelectorAll('.loc-card').length);
    if (n > 0 && prev === n) break;
    prev = n;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);

  if (NEG) {
    await page.addStyleTag({ content: `
      .loc-card { height: 120px !important; }
      .loc-groups .loc-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; }
    ` });
    await page.waitForTimeout(200);
  }

  const online = await readGroups();
  check('视图为网格分栏', online.view ?? '—', 'grid', online.view === 'grid');
  check('栏数 > 0', online.groups.length, '≥1', online.groups.length > 0);

  const types = online.groups.map((g) => g.type);
  const orderOk = types.every((t, i) => ORDER.includes(t) && (i === 0 || ORDER.indexOf(t) >= ORDER.indexOf(types[i - 1])));
  check('栏序(世界→收藏→其他→私人→离线)', types.join('/'), 'ORDER 非递减', orderOk);

  const badgeBad = online.groups.filter((g) => g.badge !== String(g.cards.length));
  check('组头人数徽标=卡数', badgeBad.length ? badgeBad.map((g) => `${g.type}:${g.badge}≠${g.cards.length}`).join(' ') : `${online.groups.length} 栏全对`,
    '全部相等', badgeBad.length === 0);

  const cards = online.groups.flatMap((g) => g.cards);
  const shown = new Set(cards.map((c) => c.u));
  check('在线人数不丢不重', `${shown.size}/${cards.length}`, `= 接口在线 ${onlineIds.size}`,
    shown.size === cards.length && cards.length === onlineIds.size
      && [...shown].every((u) => onlineIds.has(u)),
    [...onlineIds].filter((u) => !shown.has(u)).slice(0, 3).join(','));

  // 世界栏：≥2 人、同实例（location 完全相同）
  const worldGroups = online.groups.filter((g) => g.type === 'world');
  const thinWorld = worldGroups.filter((g) => g.cards.length < 2);
  check('世界栏 ≥2 人', `${worldGroups.length} 栏 / 最少 ${Math.min(...worldGroups.map((g) => g.cards.length), 99)} 人`, '≥2',
    worldGroups.length > 0 && thinWorld.length === 0);
  const mixed = worldGroups.filter((g) => new Set(g.cards.map((c) => byId.get(c.u)?.location)).size > 1);
  check('世界栏同实例', mixed.length ? mixed.map((g) => g.key).join(' ') : `${worldGroups.length} 栏全同实例`, '全部同 location',
    worldGroups.length > 0 && mixed.length === 0);
  // 真机栏内按人数降序
  const sizes = worldGroups.map((g) => g.cards.length);
  check('世界栏按人数降序', sizes.join('≥'), '非递增', sizes.every((n, i) => i === 0 || sizes[i - 1] >= n));

  // 组头区域不重复：.loc-title 不能以「区域码 + 空格」开头（真机是 [JP] 徽标 + 世界名）
  const dupRegion = online.groups.filter((g) => g.code && g.title.toUpperCase().startsWith(`${g.code.toUpperCase()} `));
  check('组头区域不重复(JPJP)', dupRegion.length ? dupRegion.map((g) => `${g.code}|${g.title}`).join(' ') : `${online.groups.length} 栏全不重复`,
    '0 栏重复', dupRegion.length === 0);

  // 私人房间：只收在线、卡片不显示世界行
  const priv = online.groups.find((g) => g.type === 'private');
  if (priv) {
    const bad = priv.cards.filter((c) => c.on !== '1');
    check('私人房间只收在线', `${priv.cards.length} 人 / 在线 ${priv.cards.filter((c) => c.on === '1').length}`, '全部在线', bad.length === 0);
    const wl = priv.cards.filter((c) => c.hasWorldLine);
    check('私人房间卡不显示世界行', wl.length ? `${wl.length} 张有` : '0 张有', '0 张', wl.length === 0);
  } else {
    check('私人房间栏', '本次数据无', '有则验', true, '无在线私人房间，跳过');
  }

  // 卡片几何（真机 friends_locations 量测）
  const hs = [...new Set(cards.map((c) => c.h))];
  check('卡片高', hs.join('/'), SPEC.card_height, hs.length === 1 && Math.abs(hs[0] - SPEC.card_height) <= 1);
  const avs = cards.map((c) => c.avatar).filter(Boolean);
  const avBad = avs.filter((a) => Math.abs(a.w - SPEC.avatar_size) > 1 || Math.abs(a.h - SPEC.avatar_size) > 1 || !a.radius.includes('50%'));
  check('头像 56 正圆', avs.length ? `${avs[0].w}x${avs[0].h} r=${avs[0].radius}` : '无', `${SPEC.avatar_size} 50%`,
    avs.length === cards.length && avBad.length === 0, avBad.length ? `${avBad.length} 张不合` : '');
  check('网格列数(1688 内窗)', online.cols, SPEC.columns, online.cols === SPEC.columns);

  // 离线 tab：全部离线、垫底、不混在线
  await page.evaluate(() => document.querySelector('[data-facet="offline"]')?.click());
  await page.waitForTimeout(900);
  const off = await readGroups();
  const offCards = off.groups.flatMap((g) => g.cards);
  const offTypes = off.groups.map((g) => g.type);
  check('离线标签下只有离线栏', offTypes.join('/') || '无', 'offline',
    offTypes.length === 1 && offTypes[0] === 'offline');
  check('离线卡 data-online=0', `${offCards.filter((c) => c.on === '0').length}/${offCards.length}`, '全部 0',
    offCards.length > 0 && offCards.every((c) => c.on === '0') && offCards.length === offlineIds.size);

  // 列表视图分组与网格一致（label 序列相同）
  await page.evaluate(() => document.querySelector('[data-facet="online"]')?.click());
  await page.waitForTimeout(600);
  const gridTitles = online.groups.map((g) => g.title);
  await page.evaluate(() => document.querySelector('[data-view="list"]')?.click());
  await page.waitForTimeout(700);
  const listTitles = await page.evaluate(() => [...document.querySelectorAll('.group-head')]
    .map((h) => (h.querySelector('span.truncate')?.textContent || '').trim()));
  check('列表视图分组同网格', listTitles.join('/') || '无', gridTitles.join('/'),
    listTitles.length === gridTitles.length && listTitles.every((t, i) => t === gridTitles[i]));
  await page.evaluate(() => document.querySelector('[data-view="grid"]')?.click());
  await page.waitForTimeout(600);

  // 私人房间组头折叠（真机行为）：点组头 → 卡全收、箭头翻向、记忆落 localStorage；刷新后仍折叠；再点恢复
  const waitCards = async () => {
    let p = -1;
    for (let i = 0; i < 40; i += 1) {
      const n = await page.evaluate(() => document.querySelectorAll('.loc-card').length);
      if (n > 0 && p === n) return n;
      p = n;
      await page.waitForTimeout(250);
    }
    return p;
  };
  if (priv) {
    const baseN = priv.cards.length;
    const clickHead = () => page.evaluate(() => {
      const h = document.querySelector('.loc-group[data-group="private"] .loc-head');
      h?.click();
      return !!h;
    });
    const readPriv = () => page.evaluate(() => {
      const s = document.querySelector('.loc-group[data-group="private"]');
      return {
        cards: s ? s.querySelectorAll('.loc-card').length : -1,
        open: s?.querySelector('.loc-caret')?.getAttribute('data-open') ?? null,
        badge: (s?.querySelector('.loc-count')?.textContent || '').trim(),
        mem: (() => { try { return localStorage.getItem('friends:private-closed'); } catch { return null; } })()
      };
    });
    const hit = await clickHead();
    await page.waitForTimeout(250);
    const c1 = await readPriv();
    check('私人房间可折叠', hit ? `卡 ${c1.cards} 箭头 ${c1.open} 记忆 ${c1.mem} 徽标 ${c1.badge}` : '组头缺失',
      `卡 0 箭头 false 记忆 1 徽标 ${baseN}`, hit && c1.cards === 0 && c1.open === 'false' && c1.mem === '1' && c1.badge === String(baseN));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitCards();
    await page.waitForTimeout(400);
    const c2 = await readPriv();
    check('折叠记忆跨刷新', `卡 ${c2.cards} 箭头 ${c2.open}`, '卡 0 箭头 false',
      c2.cards === 0 && c2.open === 'false');

    await clickHead();
    await page.waitForTimeout(300);
    const c3 = await readPriv();
    check('展开恢复卡片', `卡 ${c3.cards} 箭头 ${c3.open} 记忆 ${c3.mem}`, `卡 ${baseN} 箭头 true 记忆 0`,
      c3.cards === baseN && c3.open === 'true' && c3.mem === '0');
  } else {
    check('私人房间折叠', '本次数据无', '有则验', true, '无在线私人房间，跳过');
  }

  if (!NEG) fs.writeFileSync(OUT, JSON.stringify({
    base: BASE, viewport: VIEWPORT, at: new Date().toISOString(),
    ref: 'docs/ref/vrcx0-spec.json#friends_locations',
    pass: rows.filter((r) => r.ok).length, total: rows.length,
    rows, measured: { online, offline: off }
  }, null, 1));
  const pass = rows.filter((r) => r.ok).length;
  console.log(`\n好友位置分栏 ${pass}/${rows.length}${pass === rows.length && !NEG ? ' · LOCATIONS OK' : ''}${NEG ? '（NEG 注入态，不写基线）' : `  → ${path.relative(ROOT, OUT)}`}`);
  if (NEG) {
    const mustFail = ['卡片高', '网格列数(1688 内窗)'];
    const caught = mustFail.filter((n) => rows.some((r) => r.name === n && !r.ok));
    if (caught.length === mustFail.length) {
      console.log(`NEG OK 注入破坏被 ${caught.join(' / ')} 抓到（${pass}/${rows.length}）`);
      exitCode = 0;
    } else {
      console.log(`NEG FAIL 注入破坏未被抓到（${mustFail.filter((n) => !caught.includes(n)).join(' / ')} 仍 PASS）`);
      exitCode = 1;
    }
  } else {
    exitCode = pass === rows.length ? 0 : 1;
  }
} catch (e) {
  console.error(`LOCATIONS FAIL ${e.message}`);
  exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
process.exit(exitCode);
