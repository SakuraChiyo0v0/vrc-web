/**
 * 概览页右栏三榜单复刻对齐：`#/overview` 的「相处最久的人 / 相处变少的人 / 常遇见的路人」
 * vs 真机量测 docs/ref/overview-lists-measure.json。
 *
 *   node scripts/overview_parity.mjs [baseUrl]      # 默认 http://127.0.0.1:8891
 *   OV_NEG=1 node scripts/overview_parity.mjs       # 反向自检：注入坏几何，必须被抓到
 *
 * structure_parity 只数「右栏榜单节数 0/3」，这里把三块榜单像不像真机逐条钉死：
 *   三块榜单顺序与标题、栏宽 300、标题 24/600、副标题 18（标题下 46）、
 *   首名 hero = 116 圆头像 + 32/600 名字 + 20px 时长（名下 25）、hero 下距 55、
 *   紧凑行 = 50 圆头像 + 22px 名字、行距 71.5、
 *   灰条高 7 / 槽宽 67 / 左端固定 / 栏右内缩 25 / 长度按相对榜首占比、
 *   每块只有一个 hero 且在首行、空态有文案、末行到下块标题 138、无横向溢出。
 * 每项 PASS/DIFF；有 DIFF 就 exit 1，明细写 docs/ref/overview-lists-parity.json。
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
const REF = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/overview-lists-measure.json'), 'utf8'));
const OUT = path.join(ROOT, 'docs/ref/overview-lists-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 真机截图 1700x1040 窗口，内窗 1688x1028（同 feed_parity）
const VIEWPORT = { width: 1688, height: 1028 };
const NEG = process.env.OV_NEG === '1';
const LISTS = ['companions', 'shrinking', 'passersby'];

const rows = [];
const check = (name, got, want, ok, extra = '') => {
  rows.push({ name, got: String(got), want: String(want), ok: !!ok, extra });
  console.log(`${ok ? 'PASS' : 'DIFF'}  ${name}  我们=${got}  真机=${want}${extra ? `  (${extra})` : ''}`);
};
const near = (a, b, tol) => a !== null && a !== undefined && Math.abs(a - b) <= tol;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

let exitCode = 0;
try {
  const api = await fetch(`${BASE}/api/overview`).catch((e) => ({ ok: false, err: e }));
  if (!api.ok) throw new Error(`服务不可用：${BASE}/api/overview ${api.status ?? api.err}`);
  const data = await api.json();
  if (!Array.isArray(data?.companions) || !Array.isArray(data?.passersby)) {
    throw new Error(`${BASE}/api/overview 缺 companions/passersby，可能打到了 SPA 兜底页`);
  }

  await page.goto(`${BASE}/#/overview`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 等三块榜单 + 接口数据落地后几何稳定两次（接口慢时会量到空态，误报 0 行）
  const ready = () => page.evaluate(() => ({
    secs: document.querySelectorAll('.ov-sec').length,
    rows: document.querySelectorAll('.ov-sec .ov-person').length,
    texts: document.querySelectorAll('.ov-sec .ov-list-title').length
  }));
  let prev = null;
  for (let i = 0; i < 80; i += 1) {
    const cur = await ready();
    if (cur.secs >= 3 && cur.rows > 0 && prev && cur.rows === prev.rows && cur.secs === prev.secs) break;
    prev = cur;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);

  if (NEG) {
    await page.addStyleTag({ content: `
      .ov-list-title { font-size: 18px !important; font-weight: 400 !important; }
      .ov-person-hero .ov-av { width: 60px !important; height: 60px !important; }
      .ov-person-bar { height: 14px !important; }
      .ov-sec + .ov-sec { margin-top: 0 !important; }
    ` });
    await page.waitForTimeout(200);
  }

  const got = await page.evaluate(() => {
    const R = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right }; };
    const cs = (el) => getComputedStyle(el);
    const rail = document.querySelector('.ov-rail');
    const secs = [...document.querySelectorAll('.ov-sec')].map((s) => {
      const title = s.querySelector('.ov-list-title');
      const sub = s.querySelector('.ov-list-sub');
      const people = s.querySelector('.ov-people');
      const empty = s.querySelector(':scope > p');
      const list = [...s.querySelectorAll('.ov-person')].map((r) => {
        const av = r.querySelector('.ov-av');
        const nm = r.querySelector('.ov-person-name');
        const val = r.querySelector('.ov-person-val');
        const bar = r.querySelector('.ov-person-bar');
        const zone = r.querySelector('.ov-person-barzone');
        const avImg = av ? av.querySelector('img') : null;
        return {
          hero: r.dataset.hero === 'true',
          box: R(r),
          av: av ? R(av) : null,
          avRadius: av ? cs(av).borderRadius : null,
          avImg: !!avImg,
          avImgOk: !!avImg && avImg.complete && avImg.naturalWidth > 0,
          avCh: av ? (av.querySelector('.ov-av-ch')?.textContent || '').trim() : '',
          nameText: nm ? (nm.textContent || '').trim() : '',
          valText: val ? (val.textContent || '').trim() : '',
          name: nm ? { ...R(nm), font: cs(nm).fontSize, weight: cs(nm).fontWeight } : null,
          val: val ? { ...R(val), font: cs(val).fontSize } : null,
          bar: bar ? R(bar) : null,
          zone: zone ? R(zone) : null,
          label: (r.getAttribute('title') || '')
        };
      });
      return {
        list: s.dataset.list,
        box: R(s),
        title: title ? { text: (title.textContent || '').trim(), ...R(title), font: cs(title).fontSize, weight: cs(title).fontWeight } : null,
        sub: sub ? { text: (sub.textContent || '').trim(), ...R(sub), font: cs(sub).fontSize } : null,
        people: people ? { ...R(people), mt: parseFloat(cs(people).marginTop), gap: parseFloat(cs(people).gap) } : null,
        empty: empty ? (empty.textContent || '').trim() : null,
        list2: list
      };
    });
    return {
      rail: rail ? R(rail) : null,
      secs,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth
    };
  });

  const want = REF;
  const panelTitles = want.panels.map((p) => p.title);
  const secs = got.secs;

  check('三块榜单节数', secs.length, 3, secs.length === 3);
  check('榜单顺序', secs.map((s) => s.list).join('/'), LISTS.join('/'),
    secs.length === 3 && secs.every((s, i) => s.list === LISTS[i]));
  check('榜单标题', secs.map((s) => s.title?.text).join(' / '), panelTitles.join(' / '),
    secs.length === 3 && secs.every((s, i) => s.title?.text === panelTitles[i]));

  check('右栏宽', Math.round(got.rail?.w ?? 0), want.column.w, near(got.rail?.w, want.column.w, 1.5));

  const t0 = secs[0]?.title;
  check('标题字号', t0?.font, `${want.title.font_px}px`, near(parseFloat(t0?.font), want.title.font_px, 0.5));
  check('标题字重', t0?.weight, String(want.title.weight), Number(t0?.weight) === want.title.weight);

  const sub = secs[0]?.sub;
  check('副标题字号', sub?.font, `${want.subtitle.font_px}px`, near(parseFloat(sub?.font), want.subtitle.font_px, 0.5));
  check('副标题文案', sub?.text || '—', '遇到过 N 人', /^遇到过\s*\d+\s*人$/.test(sub?.text || ''));
  const subN = Number((sub?.text || '').match(/\d+/)?.[0]);
  check('副标题人数=接口 people_met', subN, data.people_met, subN === Number(data.people_met));
  check('标题→副标题间距', Math.round((sub?.y ?? 0) - (t0?.y ?? 0)), want.subtitle.y[0] - want.title.y[0],
    near((sub?.y ?? 0) - (t0?.y ?? 0), want.subtitle.y[0] - want.title.y[0], 2));

  // 有数据的两块（相处最久 / 常遇见的路人）才量行几何；空态块只验文案
  const filled = secs.filter((s) => s.list2.length > 0);
  check('有数据榜单块数', filled.length, '≥2', filled.length >= 2,
    filled.map((s) => `${s.list}:${s.list2.length}行`).join(' '));
  // 页面上有行的块数必须等于接口里非空的榜单数 —— 防止接口有数据但渲染丢行
  const dataRows = (k) => (Array.isArray(data[k]) ? data[k].length : 0);
  const dataFilled = LISTS.filter((k) => dataRows(k) > 0).length;
  check('有数据榜单块数=接口非空榜数', filled.length, dataFilled, filled.length === dataFilled,
    LISTS.map((k) => `${k}:${dataRows(k)}`).join(' '));

  for (const s of filled) {
    const list = s.list2;
    const hero = list.find((r) => r.hero);
    const rest = list.filter((r) => !r.hero);
    const src = s.list === 'companions' ? data.companions : s.list === 'passersby' ? data.passersby : data.shrinking;
    // 内容不空：名字、头像、首名数值都必须有真东西（空壳行几何再对也没意义）
    const noName = list.filter((r) => !r.nameText).length;
    check(`[${s.list}] 行名字非空`, noName ? `${noName} 行为空` : `${list.length}/${list.length}`, '全部非空', noName === 0);
    // 头像要么是真正加载出来的图，要么是首字占位；img 403 后不能留空心圆
    const noAv = list.filter((r) => !r.avImgOk && !r.avCh).length;
    check(`[${s.list}] 行头像有内容`, noAv ? `${noAv} 行空白` : `${list.length}/${list.length}`, '图或首字', noAv === 0,
      list.map((r) => `${r.nameText}:${r.avImgOk ? 'img' : r.avCh ? `字「${r.avCh}」` : '空'}`).slice(0, 3).join(' '));
    check(`[${s.list}] hero 数值格式`, hero?.valText || '—', '时长/次数', /^\d+\s*(分钟|小时|天)/.test(hero?.valText || ''));
    check(`[${s.list}] 顺序与接口一致`, list.map((r) => r.nameText).join('/'), src.map((r) => r.name).join('/'),
      list.length === src.length && list.every((r, i) => r.nameText === src[i]?.name));
    if (s.list === 'shrinking') {
      const noDrop = list.filter((r) => !/少\s*\d+%/.test(r.label || '')).length;
      check('[shrinking] 每行带「少 N%」', noDrop ? `${noDrop} 行缺降幅` : `${list.length}/${list.length}`, '全部带', noDrop === 0,
        list.map((r) => r.label).slice(0, 2).join(' | '));
    }
    check(`[${s.list}] 首行是 hero`, list[0]?.hero ? '是' : '否', '是', !!list[0]?.hero);
    check(`[${s.list}] hero 唯一`, list.filter((r) => r.hero).length, 1, list.filter((r) => r.hero).length === 1);
    check(`[${s.list}] hero 头像 116 圆`, `${Math.round(hero?.av?.w)}×${Math.round(hero?.av?.h)} / ${hero?.avRadius}`,
      `${want.hero.avatar.d}×${want.hero.avatar.d} / 50%`,
      near(hero?.av?.w, want.hero.avatar.d, 1.5) && near(hero?.av?.h, want.hero.avatar.d, 1.5) && /50%/.test(hero?.avRadius || ''));
    check(`[${s.list}] hero 名字 32/600`, `${hero?.name?.font}/${hero?.name?.weight}`,
      `${want.hero.name.font_px}px/${want.title.weight}`,
      near(parseFloat(hero?.name?.font), want.hero.name.font_px, 0.5) && Number(hero?.name?.weight) === 600);
    check(`[${s.list}] hero 时长 20px`, hero?.val?.font, `${want.hero.duration.font_px}px`,
      near(parseFloat(hero?.val?.font), want.hero.duration.font_px, 0.5));
    check(`[${s.list}] 名字→时长 25`, Math.round((hero?.val?.y ?? 0) - ((hero?.name?.y ?? 0) + (hero?.name?.h ?? 0))),
      want.hero.duration.below_name,
      near((hero?.val?.y ?? 0) - ((hero?.name?.y ?? 0) + (hero?.name?.h ?? 0)), want.hero.duration.below_name, 3));
    const heroBottom = (hero?.box?.y ?? 0) + (hero?.box?.h ?? 0);
    const nextTop = rest[0]?.box?.y ?? null;
    check(`[${s.list}] hero 下距 55`, nextTop === null ? '—' : Math.round(nextTop - heroBottom), want.hero.gap_below,
      nextTop === null || near(nextTop - heroBottom, want.hero.gap_below, 3));
    check(`[${s.list}] 列表上距 41`, Math.round(s.people?.mt ?? -1), want.hero.gap_above,
      near(s.people?.mt, want.hero.gap_above, 1.5));

    if (rest.length) {
      const r = rest[0];
      check(`[${s.list}] 紧凑头像 50~51`, Math.round(r.av?.w ?? 0), want.row.avatar_d,
        near(r.av?.w, want.row.avatar_d, 1.5) && near(r.av?.h, want.row.avatar_d, 1.5));
      check(`[${s.list}] 紧凑名字 22`, r.name?.font, `${want.row.name_font_px}px`,
        near(parseFloat(r.name?.font), want.row.name_font_px, 0.5));
      const pitch = rest.length > 1 ? rest[1].box.y - rest[0].box.y : null;
      check(`[${s.list}] 紧凑行距 71.5`, pitch === null ? '—' : pitch.toFixed(1), want.row.pitch,
        pitch === null || near(pitch, want.row.pitch, 2));
      const barX = [...new Set(list.filter((x) => x.bar).map((x) => Math.round(x.bar.x)))];
      check(`[${s.list}] 灰条左端固定`, barX.join('/'), '同一 x', barX.length === 1,
        `右栏右缘 ${Math.round(s.box.right)}`);
      const inset = s.box.right - (r.zone?.right ?? 0);
      check(`[${s.list}] 灰条右内缩 25`, Math.round(inset), want.section.bar_right_inset, near(inset, want.section.bar_right_inset, 2));
      check(`[${s.list}] 灰条槽宽 67`, Math.round(r.zone?.w ?? 0), want.row.bar.zone_w, near(r.zone?.w, want.row.bar.zone_w, 1.5));
      check(`[${s.list}] 灰条高 7`, Math.round(r.bar?.h ?? 0), want.row.bar.h, near(r.bar?.h, want.row.bar.h, 1));
      // 长度 ∝ 相对榜首（与前端同一公式 max(3, round(v/max*67))）
      const src = s.list === 'companions' ? data.companions : s.list === 'passersby' ? data.passersby : data.shrinking;
      const max = Math.max(1, Number(src[0]?.minutes ?? src[0]?.meets ?? 0));
      const bad = rest.map((x, i) => {
        const v = Number(src[i + 1]?.minutes ?? src[i + 1]?.meets ?? 0);
        const expect = Math.max(3, Math.round((v / max) * want.row.bar.zone_w));
        return x.bar && Math.abs(x.bar.w - expect) <= 2 ? null : `${src[i + 1]?.name}:${Math.round(x.bar?.w ?? 0)}≠${expect}`;
      }).filter(Boolean);
      check(`[${s.list}] 灰条长度∝榜首`, bad.length ? bad.join(' ') : `${rest.length} 行全对`, '±2px', bad.length === 0);
    }
  }

  const emptySec = secs.find((s) => !s.list2.length);
  if (emptySec) {
    check(`[${emptySec.list}] 空态有文案`, emptySec.empty ? `「${emptySec.empty}」` : '无', '非空', !!emptySec.empty);
  } else {
    check('空态块', '本库无空榜', '—', true);
  }

  // 节间距：末行 → 下块标题 = 138（真机 panel_gap）
  const gapOk = [];
  for (let i = 1; i < secs.length; i += 1) {
    const prevSec = secs[i - 1];
    if (!prevSec.list2.length) continue;   // 空态块自带文案高度，不参与该量
    const last = prevSec.list2[prevSec.list2.length - 1].box;
    gapOk.push({ name: `${prevSec.list}→${secs[i].list} 节间距`, got: Math.round(secs[i].title.y - (last.y + last.h)) });
  }
  for (const g of gapOk) check(g.name, g.got, want.section.panel_gap, near(g.got, want.section.panel_gap, 3));

  check('无横向溢出', `${got.scrollW}/${got.clientW}`, '相等', got.scrollW <= got.clientW);

  if (!NEG) fs.writeFileSync(OUT, JSON.stringify({
    base: BASE, viewport: VIEWPORT, at: new Date().toISOString(),
    ref: 'docs/ref/overview-lists-measure.json',
    pass: rows.filter((r) => r.ok).length, total: rows.length,
    rows, measured: got
  }, null, 1));
  const pass = rows.filter((r) => r.ok).length;
  console.log(`\n概览三榜单 ${pass}/${rows.length}${pass === rows.length && !NEG ? ' · OVERVIEW LISTS OK' : ''}${NEG ? '（NEG 注入态，不写基线）' : `  → ${path.relative(ROOT, OUT)}`}`);
  if (NEG) {
    const mustFail = ['标题字号', 'hero 头像 116 圆', '灰条高 7', 'companions→shrinking 节间距'];
    const caught = mustFail.filter((n) => rows.some((r) => r.name.includes(n) && !r.ok));
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
  console.error(`OVERVIEW LISTS FAIL ${e.message}`);
  exitCode = 1;
} finally {
  await browser.close().catch(() => {});
}
process.exit(exitCode);
