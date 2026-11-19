/**
 * 第十五轮对齐检查：docs/vrcx0-parity.md 第十五轮（全量备份导入 / CSV 多表导出 / 导出快照分享）。
 *   node server/scripts/parity15.mjs      # 临时 SQLite，退出码 0 = 全绿
 *
 * 151 CSV 表清单（index.json）与真实行数
 * 152 每张表 CSV：表头/行数/BOM/转义
 * 153 导出快照分享：POST /api/shares kind=export → /s/:id 页面 + CSV 快照不受后续写入影响
 * 154 全量备份导入：空库按 backup.json 恢复，行数与源库一致；重复导入 0 新增；默认模式不动好友/事件
 * 155 设置页接线（源码 + 构建产物）
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db/index.js';
import { TABLES } from '../src/lib/exportTables.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const asset = (ext) => {
  const dir = path.join(ROOT, 'web/dist/assets');
  must(fs.existsSync(dir), 'web/dist 不存在（先跑 cd web && npm run build）');
  const f = fs.readdirSync(dir).find((x) => x.endsWith(ext));
  must(f, `web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(dir, f), 'utf8');
};
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

/** 起一个临时 SQLite 服务，返回 { base, stop, log } */
async function boot(tag) {
  const file = path.join(os.tmpdir(), `vrc-parity15-${tag}-${Date.now()}.db`);
  const url = `sqlite:${file}`;
  const port = await freePort();
  const srv = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(ROOT, 'server'),
    env: {
      ...process.env,
      VRC_DB_URL: url,
      PORT: String(port),
      VRC_INGEST_TOKEN: 'parity15-token',
      VRC_ALERT_EMIT: '',
      VRC_IMG_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'vrc-parity15-img-')),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  let exited = null;
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  srv.on('exit', (c, s) => { exited = `exit code=${c} sig=${s ?? ''}`; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  if (!ready) {
    srv.kill('SIGTERM');
    throw new Error(`服务 ${tag} 未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);
  }
  const req = async (p, init) => {
    const r = await fetch(base + p, init);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text, headers: r.headers };
  };
  const send = (p, method, body) => req(p, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const stop = () => {
    srv.kill('SIGTERM');
    for (const f of [file, `${file}-wal`, `${file}-shm`]) { try { fs.rmSync(f); } catch {} }
  };
  return { base, url, req, send, stop, get: (p) => req(p), log: () => log };
}

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}

const at = (ms) => new Date(ms).toISOString();
const NOW = Date.now();
const SEED = {
  friends: 2, worlds: 1, events: 2, players: 2, sessions: 1,
  favorites: 1, notes: 1, tags: 1, 'game-events': 3, 'self-events': 1,
};
const TABLE_NAMES = Object.keys(TABLES);

async function seed(url) {
  const db = await openDb(url);
  const q = (sql, p) => db.query(sql, p);
  await q(`insert into friend (user_id, display_name, status, platform, updated_at) values (?,?,?,?,?)`,
    ['usr_a', '甲, 逗号', 'active', 'standalonewindows', at(NOW - 3600_000)]);
  await q(`insert into friend (user_id, display_name, status) values (?,?,?)`,
    ['usr_b', 'Quote"Name', 'offline']);
  await q(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`,
    ['wrld_a', 'Alpha Club', 'Creator A', 32]);
  await q(`insert into friend_event (user_id, display_name, kind, world_name, at) values (?,?,?,?,?)`,
    ['usr_a', '甲, 逗号', 'online', 'Alpha Club', at(NOW - 7200_000)]);
  await q(`insert into friend_event (user_id, display_name, kind, world_name, at) values (?,?,?,?,?)`,
    ['usr_a', '甲, 逗号', 'location', 'Alpha Club', at(NOW - 7000_000)]);
  await q(`insert into friend_session (id, user_id, started_at, ended_at, minutes, world_name, status) values (?,?,?,?,?,?,?)`,
    ['s1', 'usr_a', at(NOW - 7200_000), at(NOW - 3600_000), 60, 'Alpha Club', 'active']);
  await q(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
    ['room_join', '甲, 逗号', 'usr_a', 'Alpha Club', at(NOW - 7000_000)]);
  await q(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
    ['room_join', 'Quote"Name', 'usr_b', 'Alpha Club', at(NOW - 6900_000)]);
  await q(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
    ['room_leave', 'Quote"Name', 'usr_b', 'Alpha Club', at(NOW - 6800_000)]);
  await q(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['join', 'wrld_a:123', 'wrld_a', at(NOW - 7100_000)]);
  await q(`insert into favorite (id, kind, target_id, note, pinned, sort_order) values (?,?,?,?,?,?)`,
    ['fav_1', 'world', 'wrld_a', '常去', 1, 0]);
  await q(`insert into friend_note (user_id, note, updated_at) values (?,?,?)`,
    ['usr_a', '只在周末上线', at(NOW - 86400_000)]);
  await q(`insert into friend_tag (id, user_id, tag, created_at) values (?,?,?,?)`,
    ['usr_a:摄影', 'usr_a', '摄影', at(NOW - 86400_000)]);
  await db.close();
}

/** 解析 CSV（只处理本仓库会产出的形态：BOM + 逗号 + 双引号转义 + 换行结尾） */
function parseCsv(text) {
  const body = text.replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

let s1 = null;
let s2 = null;
let s3 = null;
let exitCode = 1;
try {
  s1 = await boot('main');
  await seed(s1.url);

  /* ───── 151 表清单 ───── */
  await check(151, 'CSV 多表清单：10 张表，行数与库一致', async () => {
    const r = await s1.get('/api/export/index.json');
    must(r.status === 200 && r.json?.ok, `index.json ${r.status}`);
    must(r.json.count === TABLE_NAMES.length, `count=${r.json.count}，定义 ${TABLE_NAMES.length} 张`);
    for (const name of TABLE_NAMES) {
      const t = r.json.tables.find((x) => x.name === name);
      must(t, `清单缺表 ${name}`);
      must(t.file === `api/export/${name}.csv`, `${name} 的 file 路径不对：${t.file}`);
      must(Number(t.rows) === SEED[name], `${name} 行数 ${t.rows}，种子 ${SEED[name]}`);
    }
    return `${TABLE_NAMES.length} 张表，行数全部对得上（friends=${SEED.friends} events=${SEED.events} …）`;
  });

  /* ───── 152 每张表 CSV ───── */
  await check(152, '每张表 CSV：表头/行数/BOM/逗号引号转义', async () => {
    for (const name of TABLE_NAMES) {
      const r = await s1.get(`/api/export/${name}.csv`);
      must(r.status === 200, `${name}.csv ${r.status}`);
      must(/text\/csv/.test(r.headers.get('content-type') ?? ''), `${name} content-type 不是 csv`);
      must(r.text.startsWith('\ufeff'), `${name} 缺 UTF-8 BOM（Excel 中文会乱码）`);
      const rows = parseCsv(r.text);
      must(rows.length === SEED[name] + 1, `${name} 行数 ${rows.length - 1}，种子 ${SEED[name]}`);
      must(rows[0].join(',') === TABLES[name].cols.join(','), `${name} 表头与定义不一致：${rows[0].join(',')}`);
    }
    const f = parseCsv((await s1.get('/api/export/friends.csv')).text);
    const xi = f[0].indexOf('display_name');
    const names = f.slice(1).map((r) => r[xi]).sort();
    must(names.includes('甲, 逗号') && names.includes('Quote"Name'), `逗号/引号没有原样回读：${names.join(' | ')}`);
    const bad = await s1.get('/api/export/nope.csv');
    must(bad.status === 404 && Array.isArray(bad.json?.supported), '未知表没有 404 + supported 列表');
    const legacy = await s1.get('/api/export/friends');
    must(legacy.status === 200, '不带 .csv 后缀的旧地址失效了（第二轮的下载入口）');
    return `${TABLE_NAMES.length} 张表逐一校验；逗号/引号往返一致；未知表 404`;
  });

  /* ───── 153 导出快照分享 ───── */
  await check(153, '导出快照分享：页面 + CSV，后续写入不改快照', async () => {
    const mk = await s1.send('/api/shares', 'POST', { kind: 'export', targetId: 'friends', title: '好友快照' });
    must(mk.status === 200 && mk.json?.ok, `建分享失败：${mk.status} ${mk.text.slice(0, 120)}`);
    const id = mk.json.id;
    const page = await s1.get(`/s/${id}`);
    must(page.status === 200, `分享页 ${page.status}`);
    must(page.text.includes('好友快照'), '分享页没有标题');
    must(page.text.includes('<table') && page.text.includes('甲, 逗号'), '分享页没有渲染快照表格');
    must(page.text.includes(`/s/${id}/export.csv`), '分享页缺 CSV 下载入口');

    const before = parseCsv((await s1.get(`/s/${id}/export.csv`)).text);
    must(before.length === SEED.friends + 1, `快照 CSV 行数 ${before.length - 1}`);

    // 建完链接后再写一行：快照必须还是 2 行
    const db = await openDb(s1.url);
    await db.query(`insert into friend (user_id, display_name) values (?,?)`, ['usr_late', '迟到的人']);
    await db.close();

    const after = parseCsv((await s1.get(`/s/${id}/export.csv`)).text);
    must(after.length === before.length, `快照被后续写入污染：${after.length - 1} 行`);
    const live = parseCsv((await s1.get('/api/export/friends.csv')).text);
    must(live.length === SEED.friends + 2, `实时 CSV 应有 3 行，实际 ${live.length - 1}`);

    const bad = await s1.send('/api/shares', 'POST', { kind: 'export', targetId: 'nope' });
    must(bad.status === 400, `未知表分享应 400，实际 ${bad.status}`);
    // 清理多出来的那行，后面的全量导入按原始种子算
    const db2 = await openDb(s1.url);
    await db2.query(`delete from friend where user_id = ?`, ['usr_late']);
    await db2.close();
    return `快照 ${before.length - 1} 行不被后续插入影响；实时 CSV 已变 ${live.length - 1} 行；未知表 400`;
  });

  /* ───── 154 全量备份导入 ───── */
  await check(154, '全量备份导入：空库恢复整份备份、行数一致、重复导入 0 新增', async () => {
    const bk = await s1.get('/api/export/backup.json');
    must(bk.status === 200, `backup.json ${bk.status}`);
    const payload = bk.json;
    for (const k of ['friends', 'worlds', 'events', 'favorites', 'notes', 'tags']) {
      must(Array.isArray(payload[k]), `备份缺 ${k}`);
    }
    must(payload.friends.length === SEED.friends && payload.events.length === SEED.events, '备份内容行数不对');

    s2 = await boot('restore');
    const imp = await s2.send('/api/import/backup?mode=full', 'POST', payload);
    must(imp.status === 200 && imp.json?.ok, `全量导入失败：${imp.status} ${imp.text.slice(0, 200)}`);
    must(imp.json.friends.inserted === SEED.friends, `好友导入 ${imp.json.friends?.inserted}`);
    must(imp.json.worlds.inserted === SEED.worlds, `世界导入 ${imp.json.worlds?.inserted}`);
    must(imp.json.events.inserted === SEED.events, `动态导入 ${imp.json.events?.inserted}`);

    const idx = await s2.get('/api/export/index.json');
    for (const name of ['friends', 'worlds', 'events', 'players', 'notes', 'tags', 'favorites']) {
      const t = idx.json.tables.find((x) => x.name === name);
      const want = SEED[name];
      must(Number(t.rows) === want, `导入后 ${name}=${t.rows}，源库 ${want}`);
    }
    const fCsv = parseCsv((await s2.get('/api/export/friends.csv')).text);
    must(fCsv.length === SEED.friends + 1, `导入后好友 CSV ${fCsv.length - 1} 行`);

    const again = await s2.send('/api/import/backup?mode=full', 'POST', payload);
    must(again.json.friends.inserted === 0 && again.json.events.inserted === 0, '重复导入还在插行');
    must((await s2.get('/api/export/index.json')).json.tables.find((x) => x.name === 'friends').rows === SEED.friends,
      '重复导入把好友写重了');

    s3 = await boot('default');
    const plain = await s3.send('/api/import/backup', 'POST', payload);
    must(plain.status === 200 && plain.json.ok, `默认模式导入失败 ${plain.text.slice(0, 120)}`);
    const n3 = (await s3.get('/api/export/index.json')).json.tables;
    must(n3.find((x) => x.name === 'friends').rows === 0, '默认模式不该写好友');
    must(n3.find((x) => x.name === 'events').rows === 0, '默认模式不该写事件流');
    must(n3.find((x) => x.name === 'notes').rows === 1, '默认模式应写备注');
    return `恢复 friends=${SEED.friends} worlds=${SEED.worlds} events=${SEED.events}，重复导入 0 新增；默认模式仍只写个人数据`;
  });

  /* ───── 155 设置页接线 ───── */
  await check(155, '设置页：CSV 清单 + 分享按钮 + 全量导入入口', async () => {
    const page = src('web/src/pages/SettingsPage.jsx');
    must(page.includes('data-export-list'), '设置页缺 CSV 表清单容器');
    must(page.includes('export/index.json'), '设置页没读表清单接口');
    must(page.includes('data-share-export') && page.includes("kind: 'export'"), '设置页缺导出分享按钮');
    must(page.includes('data-import-input="backup-full"'), '设置页缺全量导入入口');
    must(page.includes('?mode=full'), '全量导入没带 mode=full');
    const js = asset('.js');
    must(js.includes('data-export-list') && js.includes('全量导入'), '构建产物里没有这轮设置页改动（没重新 build？）');
    return '源码 + dist 均含清单/分享/全量导入';
  });

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  #${String(r.id).padEnd(3)} ${r.name.padEnd(34)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length
    ? `\nPARITY15 FAIL ${failed.length}/${results.length}: #${failed.map((f) => f.id).join(' #')}`
    : `\nPARITY15 OK ${results.length}/${results.length}`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('PARITY15 ERROR', e.message);
} finally {
  for (const s of [s1, s2, s3]) { try { s?.stop(); } catch {} }
  setTimeout(() => process.exit(exitCode), 300);
}
