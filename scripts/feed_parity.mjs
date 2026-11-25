/**
 * 动态页表格复刻对齐：`#/feed` 的四列表格 vs 真机量测 docs/ref/feed-measure.json。
 *
 *   node scripts/feed_parity.mjs [baseUrl]      # 默认 http://127.0.0.1:8891
 *
 * structure_parity 只比「列数/行高/前 3 列列宽」，这里把动态页真正像不像真机的东西逐条钉死：
 *   列名与列序、无头像列、表头/行高 44、列文字起点（相对内容面板）、表格右缘留白、
 *   工具条单行、无页脚、类型图标四类语义色互不相同、详细信息「区域 + 世界名 · 访问级别」。
 * 每项输出 PASS/DIFF；有 DIFF 就 exit 1，明细写 docs/ref/feed-parity.json。
 * 所有基准来自 docs/ref/feed-measure.json（scripts/measure_ref_feed.py 像素分段 + vision 读图）。
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
const REF = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/feed-measure.json'), 'utf8'));
const OUT = path.join(ROOT, 'docs/ref/feed-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 真机截图是 1700x1040 窗口，内窗 1688x1028；量测一律用内窗，避开 ≥1700 的 zoom:1.15
const VIEWPORT = { width: 1688, height: 1028 };

const rows = [];
const check = (name, got, want, ok, extra = '') => {
  rows.push({ name, got: String(got), want: String(want), ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'DIFF'}  ${name}  我们=${got}  真机=${want}${extra ? `  (${extra})` : ''}`);
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

let exitCode = 0;
try {
  // 服务活着（同 structure_parity 口径：/api/roster 必须有 total/groups）
  const api = await fetch(`${BASE}/api/roster`).catch((e) => ({ ok: false, err: e }));
  if (!api.ok) throw new Error(`服务不可用：${BASE}/api/roster ${api.status ?? api.err}`);
  const roster = await api.json();
  if (typeof roster?.total !== 'number' || !Array.isArray(roster?.groups)) {
    throw new Error(`${BASE}/api/roster 缺 total/groups，可能打到了 SPA 兜底页`);
  }

  await page.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 等表格出现且行/列读数稳定两次（接口回来前会量到空表或半截行）
  const tableReady = () => page.evaluate(() => {
    const t = document.querySelector('[data-testid="feed-table"]');
    const n = t ? t.querySelectorAll('tbody tr.feed-row').length : 0;
    const h = t ? t.querySelectorAll('thead th').length : 0;
    return { n, h };
  });
  let prev = null;
  for (let i = 0; i < 60; i += 1) {
    const cur = await tableReady();
    if (cur.n > 0 && cur.h > 0 && prev && cur.n === prev.n && cur.h === prev.h) break;
    prev = cur;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);

  // FEED_NEG=1：故意注入破坏规则，证明这套断言真的会 DIFF（不写基线 json）
  const NEG = process.env.FEED_NEG === '1';
  if (NEG) {
    await page.addStyleTag({ content: `
      .feed-tbl tbody td { height: 56px !important; padding-left: 8px !important; }
      .feed-tbl thead th { height: 56px !important; padding-left: 8px !important; }
    ` });
    await page.waitForTimeout(200);
  }

  const got = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right }; };
    const panel = document.querySelector('.workspace') || document.querySelector('main') || document.body;
    const tab = document.querySelector('[data-testid="feed-table"]');
    const ths = tab ? [...tab.querySelectorAll('thead th')] : [];
    const trs = tab ? [...tab.querySelectorAll('tbody tr.feed-row')] : [];
    const cs = (el) => getComputedStyle(el);
    // 列文字起点：cell 左边界 + padding-left（真机量测取的是文字像素起点）
    const colTextX = ths.map((th) => Math.round(th.getBoundingClientRect().x + parseFloat(cs(th).paddingLeft || 0)));
    // 类型图标：取每类第一个 glyph 的颜色
    const kinds = {};
    for (const tr of trs) {
      const ek = tr.querySelector('.ek');
      if (!ek) continue;
      const k = ek.getAttribute('data-kind');
      if (k && !(k in kinds)) {
        kinds[k] = {
          color: cs(ek).color,
          text: (ek.textContent || '').trim(),
          glyph: (ek.querySelector('.ek-glyph')?.textContent || '').trim(),
          svg: !!ek.querySelector('svg.ek-glyph'),
          svgSize: ek.querySelector('svg.ek-glyph')
            ? { w: Math.round(ek.querySelector('svg.ek-glyph').getBoundingClientRect().width), h: Math.round(ek.querySelector('svg.ek-glyph').getBoundingClientRect().height) }
            : null
        };
      }
    }
    // 详细信息列：拆 region / 世界名 / 访问级别
    const details = trs.map((tr) => {
      const td = tr.querySelector('td[data-label="详细"]');
      if (!td) return null;
      const reg = td.querySelector('.reg');
      const btn = td.querySelector('button');
      const name = (btn || td.querySelector('span:not(.reg)'));
      const txt = (td.textContent || '').replace(/\s+/g, ' ').trim();
      const access = (txt.match(/·\s*(公开|仅好友|好友\+|群组公开)/) || [])[1] || null;
      const ek = tr.querySelector('.ek');
      return {
        kind: ek?.getAttribute('data-kind') || null,
        ekText: (ek?.textContent || '').replace(/\s+/g, ' ').trim(),
        region: reg ? (reg.textContent || '').trim() : null,
        name: btn ? (btn.textContent || '').trim() : null,
        access,
        text: txt
      };
    }).filter(Boolean);
    const tb = document.querySelector('[data-testid="feed-toolbar"]');
    const tbKids = tb ? [...tb.children].map((c) => ({ cls: String(c.className), rect: r(c) })) : [];
    const tbRow = tbKids.map((k) => Math.round(k.rect.y + k.rect.h / 2));
    return {
      panel: r(panel),
      table: tab ? r(tab) : null,
      cols: ths.map((th) => (th.textContent || '').trim()),
      headerH: ths[0] ? Math.round(ths[0].getBoundingClientRect().height) : null,
      rowH: trs[0] ? Math.round(trs[0].getBoundingClientRect().height) : null,
      rowHs: [...new Set(trs.map((tr) => Math.round(tr.getBoundingClientRect().height)))],
      colTextX: colTextX.map((x) => Math.round(x - panel.getBoundingClientRect().x)),
      tableRightGap: tab ? Math.round(panel.getBoundingClientRect().right - tab.getBoundingClientRect().right) : null,
      avatarCells: tab ? tab.querySelectorAll('thead img, tbody img, .avatar').length : null,
      footer: !!document.querySelector('.feed-foot, [data-testid="feed-footer"], tfoot'),
      kinds,
      details,
      toolbar: tb ? r(tb) : null,
      toolbarRowSpread: tbRow.length ? Math.max(...tbRow) - Math.min(...tbRow) : null,
      toolbarHasSelect: !!document.querySelector('.feed-select select'),
      toolbarHasSearch: !!document.querySelector('.feed-search input'),
      rows: trs.length
    };
  });

  const want = REF;
  const wantColX = want.columns.text_x_rel;
  const wantRightGap = (want.panel.x + want.panel.w) - (want.table.x + want.table.w);

  check('列名/列序', got.cols.join('/'), want.columns.names.join('/'),
    got.cols.length === 4 && got.cols.every((c, i) => c === want.columns.names[i]));
  check('无头像列', got.avatarCells, 0, got.avatarCells === 0);
  check('表头高', got.headerH, want.table.header_h, Math.abs(got.headerH - want.table.header_h) <= 1.5);
  check('行高', got.rowH, want.table.row_h, Math.abs(got.rowH - want.table.row_h) <= 1.5,
    got.rowHs.length > 1 ? `行高不齐：${got.rowHs.join('/')}` : '');
  const colOk = wantColX.every((x, i) => Math.abs((got.colTextX[i] ?? 0) - x) <= 4);
  check('列文字起点(相对面板)', got.colTextX.join('/'), wantColX.join('/'), colOk);
  check('表格右缘留白', got.tableRightGap, wantRightGap, Math.abs(got.tableRightGap - wantRightGap) <= 6);
  check('工具条单行', got.toolbarRowSpread, '≤2', got.toolbarRowSpread !== null && got.toolbarRowSpread <= 2,
    `高 ${got.toolbar ? Math.round(got.toolbar.h) : '—'}`);
  check('工具条含类型下拉+搜索', `${got.toolbarHasSelect ? '类型' : '—'}+${got.toolbarHasSearch ? '搜索' : '—'}`,
    want.toolbar.join('+'), got.toolbarHasSelect && got.toolbarHasSearch);
  check('无页脚', got.footer ? '有' : '无', want.table.footer ? '有' : '无', got.footer === want.table.footer);

  // 类型图标四类语义色：必须有 online/offline/location/profile，颜色两两不同
  const needKinds = ['online', 'offline', 'location', 'profile'];
  const missing = needKinds.filter((k) => !got.kinds[k]);
  const colors = needKinds.map((k) => got.kinds[k]?.color).filter(Boolean);
  const uniq = new Set(colors);
  check('类型图标四类齐全', needKinds.filter((k) => got.kinds[k]).join('/') || '无', needKinds.join('/'),
    missing.length === 0, missing.length ? `缺 ${missing.join('/')}` : '');
  check('类型图标色互不相同', `${colors.length} 色 / ${uniq.size} 种`, '4 色 / 4 种', colors.length === 4 && uniq.size === 4,
    colors.join(' '));

  // 类型图标必须是矢量（字体字符会因缺字渲染成豆腐块：⌖ U+2316 在 Geist/PingFang/msyh 链上就没有）
  const svgKinds = needKinds.filter((k) => got.kinds[k]?.svg);
  const textKinds = needKinds.filter((k) => (got.kinds[k]?.glyph || '').length > 0);
  const sizes = needKinds.map((k) => got.kinds[k]?.svgSize).filter(Boolean);
  check('类型图标为矢量(非字体字符)', `${svgKinds.length} 类 svg / 字符残留 ${textKinds.length} 类`,
    '4 类 svg / 字符残留 0 类',
    svgKinds.length === 4 && textKinds.length === 0,
    sizes.map((s) => `${s.w}x${s.h}`).join(' '));

  // 详细信息列：真机是「区域 + 世界名 · 访问级别」
  const withRegion = got.details.filter((d) => d.region);
  const badRegion = withRegion.filter((d) => !/^[A-Z]{2}$/.test(d.region));
  check('区域码格式', badRegion.length ? badRegion.slice(0, 3).map((d) => d.region).join('/') : `${withRegion.length} 行全合法`,
    '两位大写', badRegion.length === 0);
  const withAccess = got.details.filter((d) => d.access);
  const badAccess = withAccess.filter((d) => !['公开', '仅好友', '好友+', '群组公开'].includes(d.access));
  check('访问级别文案', badAccess.length ? badAccess.slice(0, 3).map((d) => d.text).join(' | ') : `${withAccess.length} 行全合法`,
    '公开/仅好友/好友+/群组公开', badAccess.length === 0);
  const namedWorlds = got.details.filter((d) => d.region || d.name);
  check('详细信息有世界名', `${namedWorlds.filter((d) => d.name && d.name !== '未知世界').length}/${namedWorlds.length}`,
    '全部', namedWorlds.length > 0 && namedWorlds.every((d) => d.name && d.name !== '未知世界'));

  // 资料变更行（第33轮）：详细信息列必须给「变了什么」，不许留空/「—」
  const prof = got.details.filter((d) => d.kind === 'profile');
  const profBad = prof.filter((d) => !d.text || d.text === '—');
  check('变更行详细信息非空', `${prof.length - profBad.length}/${prof.length}`, '全部',
    prof.length > 0 && profBad.length === 0, profBad.slice(0, 2).map((d) => d.text || '空').join(' | '));
  // 具体到字段级：`昵称 → 新名` / `模型 → 已更换`，空 changes 至少给「资料更新」；不许出现未知/URL
  const profOk = prof.filter((d) => (/→/.test(d.text) || d.text === '资料更新') && !/http|未知/.test(d.text));
  check('变更内容具体(字段→值)', `${profOk.length}/${prof.length}`, '全部',
    prof.length > 0 && profOk.length === prof.length, prof.map((d) => d.text).slice(0, 3).join(' | '));
  // 三种形态各至少一条（demo 数据保证）：换模型不外露 URL / 昵称给新名 / 空 changes 给「资料更新」
  const modelRows = prof.filter((d) => /(^| · )模型 → 已更换$/.test(d.text) || /模型 → 已更换/.test(d.text));
  const nameRows = prof.filter((d) => /昵称 → \S/.test(d.text));
  const emptyRows = prof.filter((d) => d.text === '资料更新');
  check('变更三形态(模型/昵称/空)', `模型 ${modelRows.length} · 昵称 ${nameRows.length} · 资料更新 ${emptyRows.length}`,
    '各 ≥1', modelRows.length >= 1 && nameRows.length >= 1 && emptyRows.length >= 1,
    prof.map((d) => d.text).join(' | ').slice(0, 120));
  // 类型列文案：含 avatar_id 变更 →「模型变动」，其余 profile →「资料变动」；data-kind 仍是 profile
  const modelKind = prof.filter((d) => d.ekText === '模型变动');
  const plainKind = prof.filter((d) => d.ekText === '资料变动');
  check('类型列按变更分文案', `模型变动 ${modelKind.length} / 资料变动 ${plainKind.length} / 共 ${prof.length}`,
    '模型变动=模型变更行，其余=资料变动',
    prof.length > 0 && modelKind.length === modelRows.length && modelKind.length + plainKind.length === prof.length
      && prof.every((d) => d.kind === 'profile'),
    prof.map((d) => `${d.ekText}:${d.text}`).join(' | ').slice(0, 120));

  if (!NEG) fs.writeFileSync(OUT, JSON.stringify({
    base: BASE, viewport: VIEWPORT, at: new Date().toISOString(),
    ref: 'docs/ref/feed-measure.json',
    pass: rows.filter((r) => r.ok).length, total: rows.length,
    rows, measured: got
  }, null, 1));
  const pass = rows.filter((r) => r.ok).length;
  console.log(`\n动态页表格 ${pass}/${rows.length}${pass === rows.length && !NEG ? ' · FEED OK' : ''}${NEG ? '（NEG 注入态，不写基线）' : `  → ${path.relative(ROOT, OUT)}`}`);
  if (NEG) {
    // 反向验证：注入的行高 56 / padding 8 必须被「行高」「列文字起点」抓到
    const mustFail = ['行高', '列文字起点(相对面板)'];
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
  console.error(`FEED FAIL ${e.message}`);
  exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
process.exit(exitCode);
