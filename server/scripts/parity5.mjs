/**
 * 第五轮功能对齐检查：docs/vrcx0-parity.md 第五轮 51~58，一项一条断言。
 *   node server/scripts/parity5.mjs       # 临时 SQLite 库，退出码 0 为全绿
 *
 * 只起本地 server（不碰线上 PG / 不碰 VRChat）：事件与好友资料全写临时库，
 * 会话/访问区间用 backfill 的同一个推导函数生成，顺便验证「历史事件能回填」。
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db/index.js';
import { rebuildAll } from '../src/lib/behavior.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const file = path.join(os.tmpdir(), `vrc-parity5-${Date.now()}.db`);
const url = `sqlite:${file}`;

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: url, PORT: String(port), VRC_INGEST_TOKEN: 'parity5-token', VRC_ALERT_EMIT: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { log += `[spawn error] ${e.message}\n`; exited = `spawn ${e.message}`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const req = async (p, init) => {
  const r = await fetch(base + p, init);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const get = (p) => req(p);

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const asset = (ext) => {
  const dir = path.join(ROOT, 'web/dist/assets');
  must(fs.existsSync(dir), 'web/dist 不存在（先跑 cd web && npm run build）');
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(ext));
  if (!files.length) throw new Error(`web/dist/assets 里没有 ${ext}`);
  // 134 起页面按路由分 chunk：断言在全部产物里找，只读第一个文件会漏
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
};

const TZ = 8 * 3600_000;
const HOUR = 3600_000;
const DAY = 86400_000;
const now = Date.now();
const midnight = Math.floor((now + TZ) / DAY) * DAY - TZ;
const at = (ms) => new Date(ms).toISOString();

// 昨天 10:00 一段（Alpha 30 分钟 → Beta 60 分钟），今天 09:00 一段（Alpha 45 分钟）
const yBase = midnight - DAY + 10 * HOUR;
const tBase = midnight + 9 * HOUR;

let exitCode = 1;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  must(ready, `服务未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);

  // —— 样例数据：历史事件（没有会话表，靠回填推导） ——
  const db = await openDb(url);
  const ins = (sql, p) => db.query(sql, p);
  await ins(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`, ['wrld_a', 'Alpha Club', 'Creator A', 32]);
  await ins(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`, ['wrld_b', 'Beta Lounge', 'Creator B', 16]);
  await ins(`insert into friend (user_id, display_name, trust_level, status, status_description, location)
             values (?,?,?,?,?,?)`, ['usr_alice', 'Alice', null, 'active', 'working', 'wrld_a:1~region(jp)']);
  await ins(`insert into friend (user_id, display_name, status, location, world_id, world_name)
             values (?,?,?,?,?,?)`, ['usr_bob', 'Bob', 'active', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge']);
  await ins(`insert into friend (user_id, display_name) values (?,?)`, ['usr_carol', 'Carol']);

  const evs = [
    ['usr_alice', 'Alice', 'online', 'wrld_a:1~region(jp)', 'wrld_a', 'Alpha Club', yBase],
    ['usr_alice', 'Alice', 'location', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', yBase + 30 * 60000],
    ['usr_alice', 'Alice', 'offline', null, null, null, yBase + 90 * 60000],
    ['usr_alice', 'Alice', 'online', 'wrld_a:3~region(jp)', 'wrld_a', 'Alpha Club', tBase],
    ['usr_alice', 'Alice', 'offline', null, null, null, tBase + 45 * 60000],
    ['usr_bob', 'Bob', 'online', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', midnight + 11 * HOUR],
  ];
  for (const [uid, name, kind, loc, wid, wname, ms] of evs) {
    await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
               values (?,?,?,?,?,?,?)`, [uid, name, kind, loc, wid, wname, at(ms)]);
  }
  // 历史事件 → 区间（GOAL 要求：不许只从今往后）
  const bf = await rebuildAll({ db, T: (n) => n });
  await db.close();
  must(bf.users === 2 && bf.sessions >= 3 && bf.visits >= 3,
    `回填结果 users=${bf.users} sessions=${bf.sessions} visits=${bf.visits}`);

  // —— 53/54/56：走采集器真实的 handle()，模拟 pipeline 的 friend-update / notification ——
  process.env.VRC_DB_URL = url;
  process.env.VRC_NO_MAIN = '1';
  const { handle } = await import('../src/collector.js');
  await handle('friend-update', {
    userId: 'usr_alice',
    user: {
      id: 'usr_alice', displayName: 'Alice', statusDescription: 'working',
      tags: ['system_trust_trusted'], currentAvatarThumbnailImageUrl: 'av_1', iconUrl: 'icon_1',
    },
  });
  await handle('friend-update', {
    userId: 'usr_alice',
    user: {
      id: 'usr_alice', displayName: 'Alice2', statusDescription: 'gaming',
      tags: ['system_trust_veteran'], currentAvatarThumbnailImageUrl: 'av_2', iconUrl: 'icon_2',
    },
  });
  await handle('notification', {
    notification: { id: 'nt_friend_req', type: 'friendRequest', senderUserId: 'usr_bob', message: 'Bob 想加你', createdAt: at(now - 60000) },
  });
  await handle('notification', {
    notification: { id: 'nt_invite', type: 'invite', senderUserId: 'usr_carol', message: '来玩', createdAt: at(now - 120000) },
  });

  // —— 51 会话表 ——
  await check(51, 'friend_session /api/friend/:id/sessions', async () => {
    const r = await get('/api/friend/usr_alice/sessions');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.returned === 2, `alice 会话数 ${r.json.returned} != 2`);
    must(r.json.total_minutes === 135, `总时长 ${r.json.total_minutes} != 135`);
    const [latest, older] = r.json.sessions;
    must(latest.minutes === 45 && latest.world === 'Alpha Club' && latest.ended_at && latest.ongoing === false,
      `今天那段不对：${JSON.stringify(latest)}`);
    must(older.minutes === 90 && older.world === 'Beta Lounge', `昨天那段不对：${JSON.stringify(older)}`);
    must(latest.status === 'active', `status 应取 friend 表当前状态，实际 ${latest.status}`);
    must(new Date(latest.started_at).getTime() === tBase, `started_at ${latest.started_at} != ${at(tBase)}`);

    const b = await get('/api/friend/usr_bob/sessions');
    must(b.json.returned === 1 && b.json.sessions[0].ongoing === true && b.json.sessions[0].ended_at === null,
      `未下线会话应 ended_at=null，实际 ${JSON.stringify(b.json.sessions)}`);
    return `alice 2 段/135 分钟，bob 进行中`;
  });

  // —— 52 世界访问 ——
  await check(52, 'friend_world_visit /api/friend/:id/worlds', async () => {
    const r = await get('/api/friend/usr_alice/worlds');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.returned === 2 && r.json.total_visits === 3, `returned=${r.json.returned} total=${r.json.total_visits}`);
    const [a, b] = r.json.worlds;
    must(a.world_id === 'wrld_a' && a.visits === 2 && a.minutes === 75, `wrld_a ${JSON.stringify(a)}`);
    must(b.world_id === 'wrld_b' && b.visits === 1 && b.minutes === 60, `wrld_b ${JSON.stringify(b)}`);
    must(a.last_at === at(tBase), `wrld_a last_at ${a.last_at} != ${at(tBase)}`);
    const empty = await get('/api/friend/usr_carol/worlds');
    must(empty.json.returned === 0, `carol 无事件应 0，实际 ${empty.json.returned}`);
    return `wrld_a 2 次/75 分钟，wrld_b 1 次/60 分钟`;
  });

  // —— 53 资料变更 diff ——
  await check(53, 'friend_change /api/friend/:id/changes', async () => {
    const r = await get('/api/friend/usr_alice/changes');
    must(r.status === 200, `HTTP ${r.status}`);
    const byField = new Map(r.json.changes.map((c) => [c.field, c]));
    must(byField.has('display_name'), `缺 display_name 变更：${JSON.stringify(r.json.changes)}`);
    must(byField.get('display_name').old === 'Alice' && byField.get('display_name').new === 'Alice2',
      `display_name old→new 不对：${JSON.stringify(byField.get('display_name'))}`);
    must(byField.has('status_description'), '缺 status_description 变更');
    must(byField.has('avatar_id'), '缺 avatar_id 变更');
    must(byField.has('trust_rank'), '缺 trust_rank 变更');
    const only = await get('/api/friend/usr_alice/changes?field=display_name');
    must(only.json.returned === 1 && only.json.changes[0].field === 'display_name', `field 过滤失败 ${only.json.returned}`);

    // profile 事件的 payload 里也要有 changes（事件本身就是证据链）
    const db2 = await openDb(url);
    const [ev] = await db2.query(
      `select payload from friend_event where user_id = ? and kind = 'profile' order by at desc limit 1`, ['usr_alice'],
    );
    await db2.close();
    const payload = typeof ev?.payload === 'string' ? JSON.parse(ev.payload) : ev?.payload;
    must(Array.isArray(payload?.changes) && payload.changes.length >= 3,
      `profile 事件 payload.changes=${JSON.stringify(payload?.changes)}`);
    return `5 个字段有 diff，payload.changes=${payload.changes.length} 条`;
  });

  // —— 54 状态消息历史 ——
  await check(54, 'friend_status_history /api/friend/:id/status', async () => {
    const all = await get('/api/friend/usr_alice/status');
    must(all.status === 200 && all.json.returned >= 1, `returned=${all.json?.returned}`);
    must(all.json.statuses.some((s) => s.description === 'gaming'), `没记到 gaming：${JSON.stringify(all.json.statuses)}`);
    const q = await get('/api/friend/usr_alice/status?q=GAM');
    must(q.json.returned === 1 && q.json.statuses[0].description === 'gaming', `关键词大小写不敏感失败 ${q.json.returned}`);
    must(q.json.q === 'GAM', `q 回显 ${q.json.q}`);
    const none = await get('/api/friend/usr_alice/status?q=不存在的词');
    must(none.json.returned === 0, `无命中应为 0，实际 ${none.json.returned}`);
    return `2 条状态历史，关键词命中 1 条`;
  });

  // —— 55 通知存档 ——
  await check(55, 'notification /api/notifications?kind=', async () => {
    const fr = await get('/api/notifications?kind=friendRequest');
    must(fr.status === 200 && fr.json.returned === 1, `friendRequest ${fr.json.returned}`);
    must(fr.json.notifications[0].message === 'Bob 想加你' && fr.json.notifications[0].kind === 'friendRequest',
      `通知内容不对：${JSON.stringify(fr.json.notifications[0])}`);
    const inv = await get('/api/notifications?kind=invite');
    must(inv.json.returned === 1, `invite ${inv.json.returned}`);
    const all = await get('/api/notifications');
    must(all.json.returned === 2 && all.json.types.sort().join(',') === 'friendRequest,invite',
      `全部 ${all.json.returned} types=${all.json.types}`);
    return `2 条通知按 kind 各查各的`;
  });

  // —— 56 信任等级 + 头像历史 ——
  await check(56, 'trust rank + friend_avatar_history', async () => {
    const r = await get('/api/friend/usr_alice/avatars');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.trust.rank === 4 && r.json.trust.level === 'Trusted User',
      `trust ${JSON.stringify(r.json.trust)}`);
    must(r.json.trust.tags.includes('system_trust_veteran'), 'tags 没落库');
    must(r.json.current.avatar_id === 'av_2', `current avatar ${r.json.current.avatar_id}`);
    const kinds = r.json.history.map((h) => `${h.kind}:${h.value}`);
    must(kinds.includes('avatar:av_2'), `头像历史缺 av_2：${kinds.join(',')}`);
    must(kinds.includes('icon:icon_2'), `头像历史缺 icon_2：${kinds.join(',')}`);
    const prof = await get('/api/friend/usr_alice');
    must(prof.json.profile.trust_rank === 4, `好友详情 trust_rank=${prof.json.profile.trust_rank}`);
    return `rank=4(Trusted User)，头像/立绘各记 1 次变更`;
  });

  // —— 57 活跃热力图 ——
  await check(57, 'friend_heatmap /api/friend/:id/heatmap', async () => {
    const r = await get('/api/friend/usr_alice/heatmap');
    must(r.status === 200, `HTTP ${r.status}`);
    must(Array.isArray(r.json.hourly) && r.json.hourly.length === 7 && r.json.hourly.every((row) => row.length === 24),
      `矩阵维度不对：${r.json.hourly?.length}x${r.json.hourly?.[0]?.length}`);
    must(r.json.based_on === 'sessions', `based_on=${r.json.based_on}`);
    must(r.json.total > 0 && r.json.max >= 1, `total=${r.json.total} max=${r.json.max}`);
    const local = new Date(tBase + TZ);
    must(r.json.hourly[local.getUTCDay()][local.getUTCHours()] >= 1,
      `今天 09:00 那格应为 ≥1，实际 ${r.json.hourly[local.getUTCDay()][local.getUTCHours()]}`);
    must(r.json.peak && /^周[一二三四五六日] \d\d:00$/.test(r.json.peak.label), `peak=${JSON.stringify(r.json.peak)}`);
    must(r.json.weekdays.length === 7 && r.json.tz === '+08:00', 'weekdays/tz 缺');
    return `7x24，total=${r.json.total}，peak=${r.json.peak.label}`;
  });

  // —— 58 统一时间线 ——
  await check(58, 'friend_timeline /api/friend/:id/timeline', async () => {
    const r = await get('/api/friend/usr_alice/timeline?limit=100');
    must(r.status === 200, `HTTP ${r.status}`);
    const types = new Set(r.json.items.map((i) => i.type));
    for (const t of ['event', 'session', 'visit', 'status', 'change']) {
      must(types.has(t), `时间线缺 ${t}：${[...types].join(',')}`);
    }
    const times = r.json.items.map((i) => i.at);
    const sorted = [...times].sort().reverse();
    must(times.join('|') === sorted.join('|'), '时间线不是时间倒序');
    must(times.every((t) => t), '有时间项缺 at');
    const sinceQ = await get(`/api/friend/usr_alice/timeline?since=${encodeURIComponent(at(tBase))}`);
    must(sinceQ.json.items.length > 0 && sinceQ.json.items.every((i) => i.at >= at(tBase)),
      `since 过滤失败：${sinceQ.json.items.length}`);
    const page1 = await get('/api/friend/usr_alice/timeline?limit=2');
    must(page1.json.returned === 2 && page1.json.has_more === true, `分页 returned=${page1.json.returned} has_more=${page1.json.has_more}`);
    return `${r.json.items.length} 条，5 类混排倒序，分页正常`;
  });
  // —— 57w 页面渲染：构建产物里必须有热力图与时间线的接线 ——
  await check('57w', 'web 渲染 热力图/时间线', async () => {
    const js = asset('.js');
    for (const token of ['活跃时段', 'friend-heatmap', '时间线', 'friend-timeline', '最近在线', 'friend-sessions']) {
      must(js.includes(token), `构建产物缺「${token}」`);
    }
    must(/rgba\(94,160,255/.test(js), '热力图配色没进构建产物');
    return 'FriendDrawer 已接线热力图 + 会话 + 常去世界 + 时间线';
  });
} catch (e) {
  console.error('PARITY5 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file, { force: true }); } catch {}
}

const ok = results.filter((r) => r.ok).length;
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
const fail = results.filter((r) => !r.ok).length;
console.log(fail === 0 && results.length === 9 ? `PARITY5 OK ${ok}/${results.length}` : `PARITY5 FAIL ${ok}/${results.length}`);
if (fail === 0 && results.length === 9) exitCode = 0;
process.exit(exitCode);
