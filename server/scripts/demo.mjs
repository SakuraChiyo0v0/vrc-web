/**
 * 演示/截图用服务：临时 SQLite 种子 + 真实 server（含 web/dist 静态站）。
 *   node server/scripts/demo.mjs [port]        # 默认 8891，Ctrl-C 退出（8899 上常驻图片墙容器，别用）
 *
 * 只写临时库（os.tmpdir），不碰线上 PG / VRChat。种子与 parity7 一致，
 * 目的是让「概览 / 好友位置 / 动态 / 游戏日志」四页都有数据可看。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const port = Number(process.argv[2] ?? 8891);
const file = path.join(os.tmpdir(), `vrc-demo-${process.pid}.db`);
const dbUrl = `sqlite:${file}`;

const MIN = 60_000;
const now = Date.now();
const at = (ms) => new Date(ms).toISOString();
const daysAgo = (n) => now - n * 86400_000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 端口预检：上一轮残留的 demo/index 进程会占着 8899，子服务 bind 失败但旧实例照样回 200，
// 截出来的图全是旧库（第十二轮就踩过：roster.total=4 让探活蒙过去）。宁可起不来也别截错库。
const probePort = () => new Promise((resolve) => {
  const s = net.connect({ host: '127.0.0.1', port });
  s.once('connect', () => { s.destroy(); resolve(true); });
  s.once('error', () => resolve(false));
  setTimeout(() => { s.destroy(); resolve(false); }, 800);
});
if (await probePort()) {
  console.error(`[demo] 端口 ${port} 已被占用（残留 demo 进程），先跑：pkill -f 'demo[.]mjs ${port}'`);
  process.exit(1);
}

// 顺序很重要：先建库+种子，再起服务。以前是先起服务再种子，两者同时初始化
// 同一个 SQLite 文件会撞 "database is locked"，子服务直接退出、种子落进没人读的库。
const db = await openDb(dbUrl);
const ins = (sql, p) => db.query(sql, p);
// 106 世界详情要作者/容量/官方访问量：演示库也给全，抽屉四格才有真数字可看
const world106 = [
  ['wrld_a', 'Alpha Club', 'yuina', 32, 128450, 9821, 3.4],
  ['wrld_b', 'Beta Lounge', 'chill_room', 24, 9870, 412, 1.2],
  ['wrld_c', '夜の喫茶店', 'kissa_ten', 16, 45210, 2604, 2.8],
];
for (const [id, name, author, cap, visits, favs, pop] of world106) {
  await ins(`insert into world (id, name, author_name, capacity, visits_total, favorites, popularity)
             values (?,?,?,?,?,?,?)`, [id, name, author, cap, visits, favs, pop]);
}
// 114 世界库筛选：两个小容量世界 + 都收藏、都去过≥3 次，组合筛选（收藏 + ≥3 次 + ≤8 人）才有行可看，
// 否则截图只剩空态（第十一轮截图曾因演示库没有小世界而 total=0）
const world114 = [
  ['wrld_d', 'Cube Garden', 'pico', 8, 31200, 1900, 1.8],
  ['wrld_e', 'Tiny Studio', 'mika', 6, 8700, 640, 0.9],
];
for (const [id, name, author, cap, visits, favs, pop] of world114) {
  await ins(`insert into world (id, name, author_name, capacity, visits_total, favorites, popularity)
             values (?,?,?,?,?,?,?)`, [id, name, author, cap, visits, favs, pop]);
  await ins(`insert into favorite (id, kind, target_id, sort_order) values (?,?,?,?)`,
    [`fav_${id}`, 'world', id, 0]);
}
// 对齐真机好友列表：20 行/页 + 9 列（序号/模型/昵称/信誉/状态/语言/社交链接/一起玩次数/时长）。
// 这里补 16 个带 tags（language_*）与头像的好友，让演示库刚好一页 20 行。
const extraFriends = [
  ['usr_f01', 'Kirito', 'system_trust_trusted', 'eng', 'active', 'wrld_a:9~region(jp)', 'wrld_a', 'Alpha Club'],
  ['usr_f02', 'さくら', 'system_trust_known', 'jpn', 'join me', 'wrld_c:5~region(jp)', 'wrld_c', '夜の喫茶店'],
  ['usr_f03', 'Yuki', 'system_trust_basic', 'jpn', 'offline', null, null, null],
  ['usr_f04', 'Momo', 'system_trust_known', 'zho', 'active', 'wrld_b:4~region(us)', 'wrld_b', 'Beta Lounge'],
  ['usr_f05', 'Nova', 'system_trust_trusted', 'eng', 'busy', 'wrld_d:2~region(jp)', 'wrld_d', 'Cube Garden'],
  ['usr_f06', 'あかり', 'system_trust_veteran', 'jpn', 'active', 'wrld_c:1~region(jp)', 'wrld_c', '夜の喫茶店'],
  ['usr_f07', 'Lin', 'system_trust_basic', 'zho', 'offline', null, null, null],
  ['usr_f08', 'Rin', 'system_trust_known', 'jpn', 'ask me', 'wrld_e:1~region(jp)', 'wrld_e', 'Tiny Studio'],
  ['usr_f09', 'Kai', 'system_trust_known', 'eng', 'offline', null, null, null],
  ['usr_f10', 'ひなた', 'system_trust_trusted', 'jpn', 'active', 'wrld_a:7~region(jp)', 'wrld_a', 'Alpha Club'],
  ['usr_f11', 'Sora', 'system_trust_basic', 'jpn', 'offline', null, null, null],
  ['usr_f12', 'Nia', 'system_trust_known', 'eng', 'join me', 'wrld_b:8~region(us)', 'wrld_b', 'Beta Lounge'],
  ['usr_f13', '小雪', 'system_trust_trusted', 'zho', 'active', 'wrld_d:3~region(jp)', 'wrld_d', 'Cube Garden'],
  ['usr_f14', 'Tsuki', 'system_trust_basic', 'jpn', 'offline', null, null, null],
  ['usr_f15', 'Echo', 'system_trust_known', 'eng', 'active', 'wrld_e:2~region(jp)', 'wrld_e', 'Tiny Studio'],
  ['usr_f16', 'みお', 'system_trust_trusted', 'jpn', 'offline', null, null, null],
];
for (const [uid, name, tl, lang, st, loc, wid, wname] of extraFriends) {
  await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, world_id, world_name, icon_url, avatar_id, tags, is_favorite, updated_at)
             values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uid, name, tl, 'standalonewindows', st, loc, wid, wname, null,
      `https://api.vrchat.cloud/api/1/image/file_${uid.slice(4)}_thumb/1/512`,
      JSON.stringify([`language_${lang}`, 'system_trust_basic', 'system_trust_known']),
      0, at(now - 3 * MIN)]);
}
// 好友位置分栏演示：同一实例 2 人（世界栏成组）+ 在线私人房间（可折叠组）
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, status_description, location, world_id, world_name, icon_url, avatar_id, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_kudan', '旧日崩解', 'system_trust_trusted', 'standalonewindows', 'join me', '在挂机听歌', 'wrld_a:9~region(jp)', 'wrld_a', 'Alpha Club', null, 'av_2', 0, at(now - 4 * MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, status_description, location, world_id, world_name, icon_url, avatar_id, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_zk', 'ZKOAC', 'system_trust_known', 'standalonewindows', 'active', '喵喵可爱捏', 'private', null, null, null, 'av_3', 0, at(now - 5 * MIN)]);
// 105 拼音搜索：中文名好友，用来截「xh → 小红」
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, world_id, world_name, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_xiaohong', '小红', 'system_trust_known', 'standalonewindows', 'active', 'wrld_c:1~region(jp)', 'wrld_c', '夜の喫茶店', 'av_4', 0, at(now - MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, status_description, location, world_id, world_name, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_alice', 'Alice', 'system_trust_trusted', 'standalonewindows', 'active', '画图', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 'av_1', 1, at(now - MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?)`,
  ['usr_bob', 'Bob', 'system_trust_known', 'android', 'offline', 'offline', 'av_2', 0, at(now - 5 * 60 * MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, world_id, world_name, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_carol', 'Carol', 'system_trust_basic', 'standalonewindows', 'join me', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 'av_3', 0, at(now - MIN)]);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_alice', 'usr_alice', at(now - 36 * MIN), null, null, 'wrld_a:1~region(jp)', 'wrld_a', 'Alpha Club', 'active']);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_carol', 'usr_carol', at(now - 20 * MIN), null, null, 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 'join me']);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_bob', 'usr_bob', at(now - 90 * MIN), at(now - 60 * MIN), 30, 'wrld_a:1', 'wrld_a', 'Alpha Club', 'active']);

// 124 足迹：抽屉「足迹」tab 要能看到「默认折叠 + 展开只取最近 10 条」。
// friend_event（上线/下线/换房）在足迹里被过滤掉，所以这里只种会话/到访/状态/资料变更：
// 12 次到访 + 4 段历史会话 + 2 条状态 + 2 条资料变更 = 20 条非事件项，展开后应只出现 10 条。
const aliceVisits = [
  [1, 'wrld_a', 'Alpha Club', 'wrld_a:1~region(jp)', 74],
  [2, 'wrld_c', '夜の喫茶店', 'wrld_c:2~region(jp)', 41],
  [3, 'wrld_a', 'Alpha Club', 'wrld_a:2~region(jp)', 128],
  [4, 'wrld_b', 'Beta Lounge', 'wrld_b:1~region(us)', 22],
  [5, 'wrld_c', '夜の喫茶店', 'wrld_c:1~region(jp)', 96],
  [6, 'wrld_a', 'Alpha Club', 'wrld_a:1~region(jp)', 55],
  [7, 'wrld_d', 'Cube Garden', 'wrld_d:1~region(jp)', 18],
  [8, 'wrld_b', 'Beta Lounge', 'wrld_b:3~region(us)', 63],
  [9, 'wrld_c', '夜の喫茶店', 'wrld_c:2~region(jp)', 87],
  [10, 'wrld_a', 'Alpha Club', 'wrld_a:1~region(jp)', 112],
  [11, 'wrld_c', '夜の喫茶店', 'wrld_c:1~region(jp)', 34],
  [12, 'wrld_a', 'Alpha Club', 'wrld_a:2~region(jp)', 149]
];
for (const [d, wid, wname, loc, mins] of aliceVisits) {
  await ins(`insert into friend_world_visit (id, user_id, world_id, world_name, location, started_at, ended_at, minutes)
             values (?,?,?,?,?,?,?,?)`,
    [`v_alice_${d}`, 'usr_alice', wid, wname, loc, at(now - d * 86400_000 - mins * MIN), at(now - d * 86400_000), mins]);
}
for (const [d, mins, wid, wname] of [[2, 46, 'wrld_c', '夜の喫茶店'], [4, 78, 'wrld_a', 'Alpha Club'], [6, 31, 'wrld_b', 'Beta Lounge'], [9, 64, 'wrld_a', 'Alpha Club']]) {
  await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
             values (?,?,?,?,?,?,?,?,?)`,
    [`s_alice_d${d}`, 'usr_alice', at(now - d * 86400_000 - mins * MIN), at(now - d * 86400_000), mins, `${wid}:1`, wid, wname, 'active']);
}
for (const [d, st, desc] of [[1, 'busy', '在剪视频'], [3, 'active', '画图']]) {
  await ins(`insert into friend_status_history (user_id, status, description, at) values (?,?,?,?)`,
    ['usr_alice', st, desc, at(now - d * 86400_000 - 5 * MIN)]);
}
for (const [d, field, oldV, newV] of [[2, 'display_name', 'Alice.', 'Alice'], [5, 'bio', '旧签名', '今晚 VR 见']]) {
  await ins(`insert into friend_change (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`,
    ['usr_alice', field, oldV, newV, at(now - d * 86400_000 - 8 * MIN)]);
}

// 动态页（80）需要 friend_event：上线 / 换房 / 活跃 / 下线各来几条，带区域与访问级别
const feed = [
  ['usr_alice', 'Alice', 'location', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 4],
  ['usr_bob', 'Bob', 'offline', 'offline', null, null, 12],
  ['usr_carol', 'Carol', 'location', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 20],
  ['usr_dave', 'Dave', 'online', 'wrld_c:3~group(grp_1)~region(jp)', 'wrld_c', '夜の喫茶店', 35],
  ['usr_alice', 'Alice', 'active', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 48],
  ['usr_carol', 'Carol', 'profile', null, null, null, 70],
  ['usr_dave', 'Dave', 'offline', 'offline', null, null, 95],
  ['usr_bob', 'Bob', 'location', 'wrld_a:1~friends(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 130],
];
for (const [uid, name, kind, loc, wid, wname, mins] of feed) {
  await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
             values (?,?,?,?,?,?,?)`, [uid, name, kind, loc, wid, wname, at(now - mins * MIN)]);
}

// 我的足迹：近 7 天每天 1~3 段，供概览/行程/游戏日志有形状
const plan = [
  [6, 'wrld_a', 'Alpha Club', 95], [6, 'wrld_c', '夜の喫茶店', 40],
  [5, 'wrld_b', 'Beta Lounge', 70], [4, 'wrld_a', 'Alpha Club', 120],
  [3, 'wrld_c', '夜の喫茶店', 55], [2, 'wrld_a', 'Alpha Club', 80],
  [1, 'wrld_b', 'Beta Lounge', 45], [1, 'wrld_a', 'Alpha Club', 30],
  [0, 'wrld_a', 'Alpha Club', 60],
  // 114 截图用：两个小世界各去 3+ 次，配合上面的收藏，「收藏+≥3次+≤8人」才有非空结果
  [4, 'wrld_e', 'Tiny Studio', 25], [3, 'wrld_e', 'Tiny Studio', 20],
  [2, 'wrld_e', 'Tiny Studio', 35], [1, 'wrld_e', 'Tiny Studio', 30],
  [3, 'wrld_d', 'Cube Garden', 40], [2, 'wrld_d', 'Cube Garden', 35],
  [0, 'wrld_d', 'Cube Garden', 30],
];
for (const [d, wid, wname, mins] of plan) {
  // myIntervals 语义：相邻两条 location 事件之间算一次停留 → 进入写世界，退出写 offline
  const start = daysAgo(d) - mins * MIN - 2 * 60 * MIN;
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', `${wid}:1~region(jp)`, wid, at(start)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'offline', null, at(start + mins * MIN)]);
  // 81 游戏日志真机结构：每次停留里要有足够多的进出事件（真机一屏 ~21 行）
  const crew = [
    ['Dave', 'usr_dave'], ['Alice', 'usr_alice'], ['Bob', 'usr_bob'],
    ['Carol', 'usr_carol'], ['Yu-V', 'usr_yuv'], ['pomelo0511', 'usr_pomelo'],
    ['水果蘸水果', 'usr_fruit'], ['Mika', 'usr_mika']
  ];
  const step = Math.max(3, Math.floor(mins / 10));
  for (let i = 0; i < crew.length; i += 1) {
    const [name, uid] = crew[i];
    const tJoin = start + (5 + i * step) * MIN;
    if (tJoin >= start + mins * MIN) break;
    await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
      ['room_join', name, uid, null, wname, null, at(tJoin)]);
    const tLeave = tJoin + 2 * MIN;
    if (tLeave < start + mins * MIN) {
      await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
        ['room_leave', name, uid, null, wname, null, at(tLeave)]);
    }
  }
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['room_join', 'Dave', 'usr_dave', null, wname, null, at(start + 5 * MIN)]);
}
// 182 旅程按月折叠需要跨月数据：仅 DEMO_SPAN 打开时补 30~100 天前的停留，
// 默认不种，避免改动其他轮次已入库的截图基线。
if (process.env.DEMO_SPAN) {
  for (const [d, wid, wname, mins] of [
    [35, 'wrld_a', 'Alpha Club', 88], [38, 'wrld_c', '夜の喫茶店', 52],
    [67, 'wrld_b', 'Beta Lounge', 64], [95, 'wrld_a', 'Alpha Club', 40]
  ]) {
    const start = daysAgo(d) - mins * MIN;
    await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
      ['location', `${wid}:1~region(jp)`, wid, at(start)]);
    await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
      ['location', 'offline', null, at(start + mins * MIN)]);
  }
}
await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
  ['room_join', 'Dave', 'usr_dave', null, 'Alpha Club', null, at(now - 60 * MIN)]);
await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
  ['room_join', 'Alice', 'usr_alice', null, 'Alpha Club', null, at(now - 50 * MIN)]);
// 正在进行的一次：只有进入、没有退出 → 区间到 now，供右栏「相处最久的人」有数据
await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
  ['location', 'wrld_a:1~region(jp)', 'wrld_a', at(now - 100 * MIN)]);
// 动态页（/api/events → friend_event）：五种 kind 都摆一条，location 带 region/access 让「JP · 仅好友」有意义
const ev = (kind, uid, name, loc, wid, wname, minsAgo) =>
  ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at) values (?,?,?,?,?,?,?)`,
    [uid, name, kind, loc, wid, wname, at(now - minsAgo * MIN)]);
await ev('online', 'usr_alice', 'Alice', 'wrld_a:1~region(jp)~hidden(usr_me)', 'wrld_a', 'Alpha Club', 95);
await ev('location', 'usr_alice', 'Alice', 'wrld_b:2~region(jp)~group(grp_1)', 'wrld_b', 'Beta Lounge', 80);
await ev('active', 'usr_alice', 'Alice', 'wrld_b:2~region(jp)~group(grp_1)', 'wrld_b', 'Beta Lounge', 74);
await ev('location', 'usr_alice', 'Alice', 'wrld_a:3~region(jp)~hidden(usr_me)', 'wrld_a', 'Alpha Club', 36);
await ev('profile', 'usr_carol', 'Carol', null, null, null, 30);
await ev('online', 'usr_carol', 'Carol', 'wrld_b:2~region(us)~friends(usr_me)', 'wrld_b', 'Beta Lounge', 20);
await ev('offline', 'usr_bob', 'Bob', 'offline', null, null, 18);
await ev('location', 'usr_dave', 'Dave', 'wrld_c:4~region(jp)', 'wrld_c', '夜の喫茶店', 8);
// 118 动态分段：昨天 / 更早各来两条，截图才能看到「今天/昨天/更早」三个段头
await ev('online', 'usr_bob', 'Bob', 'wrld_b:1~region(us)', 'wrld_b', 'Beta Lounge', 26 * 60);
await ev('offline', 'usr_alice', 'Alice', 'offline', null, null, 28 * 60);
await ev('location', 'usr_carol', 'Carol', 'wrld_c:2~region(jp)', 'wrld_c', '夜の喫茶店', 52 * 60);
await ev('active', 'usr_dave', 'Dave', 'wrld_c:3~region(jp)', 'wrld_c', '夜の喫茶店', 76 * 60);
// 73 好友日志真机一屏 ~19 行：近 24h 再铺一批流水（不同类型混排）
const log73 = [
  ['online', 'usr_alice', 'Alice', 1], ['location', 'usr_bob', 'Bob', 3],
  ['status', 'usr_carol', 'Carol', 7], ['online', 'usr_dave', 'Dave', 11],
  ['profile', 'usr_alice', 'Alice', 15], ['location', 'usr_carol', 'Carol', 21],
  ['offline', 'usr_bob', 'Bob', 27], ['online', 'usr_mika', 'Mika', 33],
  ['status', 'usr_yuv', 'Yu-V', 40], ['location', 'usr_pomelo', 'pomelo0511', 47],
  ['online', 'usr_fruit', '水果蘸水果', 55], ['profile', 'usr_dave', 'Dave', 63],
  ['offline', 'usr_carol', 'Carol', 71], ['location', 'usr_alice', 'Alice', 79],
  ['online', 'usr_bob', 'Bob', 88], ['status', 'usr_mika', 'Mika', 97]
];
for (const [kind, uid, name, mins] of log73) {
  await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
             values (?,?,?,?,?,?,?)`,
    [uid, name, kind, kind === 'location' ? 'wrld_a:1~region(jp)' : null, kind === 'location' ? 'wrld_a' : null, kind === 'location' ? 'Alpha Club' : null, at(now - mins * MIN)]);
}

// 104 通知聚合：两条 invite 在 24h 内应合成一条带 ×2，另有一条 friend_request 单独成条
const notif104 = [
  ['n_inv_1', 'invite', 'usr_alice', 'Alice 邀请你去 Alpha Club', 10, 0],
  ['n_inv_2', 'invite', 'usr_carol', 'Carol 邀请你去 Beta Lounge', 95, 1],
  ['n_req_1', 'friend_request', 'usr_dave', 'Dave 想加你为好友', 40, 0],
  ['n_inv_3', 'invite', 'usr_xiaohong', '小红 邀请你去 夜の喫茶店', 60 * 30, 1],
];
for (const [id, type, uid, msg, mins, seen] of notif104) {
  await ins(`insert into notification (id, type, sender_user_id, message, created_at, seen) values (?,?,?,?,?,?)`,
    [id, type, uid, msg, at(now - mins * MIN), seen]);
}
const counts = (await db.query(`select
  (select count(*) from friend) as friends,
  (select count(*) from self_event) as self_events,
  (select count(*) from friend_event) as feed,
  (select count(*) from game_event) as game_events`))[0];
await db.close();
const empty = Object.entries(counts).filter(([, n]) => !Number(n)).map(([k]) => k);
if (empty.length) {
  console.error(`[demo] 种子为空：${empty.join(',')}（库 ${file}）`);
  process.exit(1);
}
console.log(`[demo] 种子 ${JSON.stringify(counts)}`);

// 种子落盘后再起服务，探活失败/子进程退出直接报错，避免截到空态。
const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'demo-token', VRC_ALERT_EMIT: '' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
let childDead = null;
srv.on('exit', (code) => { childDead = code; });
let up = false;
// 负载高时（NAS 上并行跑批量任务，load avg >10）子服务首启实测 >20s，
// 20s 判死会误杀：给到 60s。
for (let i = 0; i < 300; i++) {
  if (childDead !== null) {
    console.error(`[demo] 子服务退出 code=${childDead}（端口 ${port} 被占用？先杀掉残留 demo/服务进程）`);
    process.exit(1);
  }
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/roster`);
    if (r.ok) {
      const probe = await r.json();
      if (!probe.total) { console.error('[demo] 端口上跑的是别的实例（roster.total=0），种子没被读到'); process.exit(1); }
      // 指纹：第十二轮种子给 Alice 造了 12 次到访，端口上的库读不到就是旧实例
      const tl = await (await fetch(`http://127.0.0.1:${port}/api/friend/usr_alice/timeline?limit=60`)).json();
      if ((tl.counts?.visit ?? 0) < 12) {
        console.error(`[demo] 端口 ${port} 上的库没有本轮种子（visit=${tl.counts?.visit ?? 0}），疑似旧实例`);
        process.exit(1);
      }
      up = true;
      break;
    }
  } catch {}
  await wait(200);
}
if (!up) { console.error('[demo] 服务 20s 内未就绪'); process.exit(1); }

fs.writeFileSync(path.join(os.tmpdir(), 'vrc-demo.url'), `http://127.0.0.1:${port}/\n`);
console.log(`DEMO READY http://127.0.0.1:${port}/  db=${file}`);
process.on('SIGTERM', () => { srv.kill('SIGTERM'); fs.rmSync(file, { force: true }); process.exit(0); });
setInterval(() => {}, 1 << 30);
