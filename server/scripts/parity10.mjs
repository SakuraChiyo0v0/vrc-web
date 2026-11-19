/**
 * 第十轮对齐检查（docs/vrcx0-parity.md 101~108：交互深度）。
 *   node server/scripts/parity10.mjs      # 读构建产物 + 源码 + 纯函数，退出码 0 为全绿
 *
 * 前端项断言构建产物（先 `cd web && npm run build`）。
 * 未实现的项不注册 check，结束时按 IMPLEMENTED 计数输出 PARTIAL，全部 8 项齐了才是 PARITY10 OK。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SORT_COLUMNS, sortRows, toggleSort, readPref, writePref } from "../../web/src/lib/sort.js";
import { GROUP_MODES, groupFriends } from "../../web/src/lib/group.js";
import { matchText } from "../../web/src/lib/pinyin.js";
import { SHORTCUT_GROUPS } from "../../web/src/lib/shortcuts.js";
import { aggregateNotifications } from "../src/lib/notif.js";
import { toCsv, csvCell } from "../../web/src/lib/csv.js";

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist/assets');
const asset = (ext) => {
  if (!fs.existsSync(distDir)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  const f = fs.readdirSync(distDir).find((x) => x.endsWith(ext));
  if (!f) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(distDir, f), 'utf8');
};

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/* 已实现的项数：每轮补齐后改这个数（8 = 全部） */
const TOTAL_ITEMS = 8;

let exitCode = 1;
try {
  const css = asset('.css');
  const js = asset('.js');

  /* ───── 101 表头点击排序：四页可点，箭头指示方向 ───── */
  await check(101, '好友/玩家/世界/好友历史四页表头可点排序，箭头指方向', async () => {
    const sh = read('web/src/components/SortHead.jsx');
    must(sh.includes('aria-sort'), 'SortTh 没有 aria-sort');
    must(sh.includes('data-sort={col}') && sh.includes('data-dir={dir}'), '列头按钮缺 data-sort/data-dir');
    must(sh.includes("dir === 'asc' ? '↑' : '↓'"), '缺方向箭头');

    // 五个排序表（四页 + 好友列表），字段齐全
    for (const section of ['friends', 'players', 'worlds', 'friendlog', 'friendlist']) {
      must(SORT_COLUMNS[section], `SORT_COLUMNS 缺 ${section}`);
      must(Object.keys(SORT_COLUMNS[section]).length >= 3, `${section} 排序列太少`);
    }
    for (const [page, marker] of [
      ['FriendsPage', 'SortCol'], ['PlayersPage', 'SortTh'], ['WorldsPage', 'SortCol'], ['FriendLogPage', 'SortCol'],
    ]) {
      const s = read(`web/src/pages/${page}.jsx`);
      must(s.includes(marker) && s.includes('useSort('), `${page} 没有接表头排序`);
    }

    // 纯函数行为：点同一列切方向、换列用默认方向、空值垫底
    const rows = [{ n: 'b', v: 1 }, { n: 'a', v: 3 }, { n: 'c', v: null }];
    const cols = { e: { dir: 'asc', type: 'text', get: (r) => r.n }, v: { dir: 'desc', type: 'num', get: (r) => r.v } };
    must(sortRows(rows, cols, 'v', 'desc')[0].n === 'a', '数值列降序不对');
    must(sortRows(rows, cols, 'v', 'asc').at(-1).n === 'c', '空值没垫底');
    must(toggleSort({ key: 'e', dir: 'asc' }, cols, 'e').dir === 'desc', '同列点击没切方向');
    must(toggleSort({ key: 'e', dir: 'asc' }, cols, 'v').dir === 'desc', '换列没用该列默认方向');

    // 世界库服务端要认新的排序键与方向
    const r4 = read('server/src/routes/round4.js');
    must(r4.includes("'name'") && r4.includes("'author'"), '世界库 API 不支持 name/author 排序');
    must(r4.includes("req.query.dir"), '世界库 API 不认 dir=asc|desc');

    must(js.includes('data-sort') && js.includes('aria-sort'), '构建产物缺排序列头');
    must(/\.sort-btn\s*\{/.test(css) && /\.sort-arrow\s*\{/.test(css), 'CSS 缺 .sort-btn/.sort-arrow');
    return '四页列头可点；箭头指示；数值/时间列可切升降；世界库服务端同步支持 name/author + dir';
  });

  /* ───── 102 筛选状态持久化：刷新后筛选与排序保持 ───── */
  await check(102, '刷新后筛选/排序保持（localStorage）', async () => {
    const p = read('web/src/lib/prefs.js');
    must(p.includes('usePref') && p.includes('useSort'), 'prefs.js 缺 usePref/useSort');
    must(p.includes('localStorage'), 'prefs.js 没走 localStorage');

    // 桩测试：写入→读回；坏 JSON→默认；无 storage→默认且不抛
    const map = new Map();
    const s = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
    must(writePref(s, 'friends:tab', 'all') === true, 'writePref 没写入');
    must([...map.keys()][0] === 'vrc-pref:friends:tab', '偏好键缺 vrc-pref: 前缀');
    must(readPref(s, 'friends:tab', 'online') === 'all', 'readPref 读不回刚写的值');
    must(readPref(s, 'missing', 24) === 24, '缺键时没回落默认值');
    must(readPref({ getItem: () => '{bad' }, 'x', 'fb') === 'fb', '坏 JSON 没回落默认值');
    must(readPref(null, 'x', 'fb') === 'fb', '无 storage 时抛错/不回落');

    // 页面接线：好友位置 tab/搜索、世界库搜索、好友历史时间窗与类型
    const wired = [
      ['FriendsPage', "usePref('friends:tab'"], ['FriendsPage', "usePref('friends:q'"],
      ['WorldsPage', "usePref('worlds:q'"], ['FriendLogPage', "usePref('friendlog:hours'"],
      ['FriendLogPage', "usePref('friendlog:kinds'"],
    ];
    for (const [page, frag] of wired) {
      must(read(`web/src/pages/${page}.jsx`).includes(frag), `${page} 没接 ${frag}`);
    }

    // 86 的地址栏筛选也要写一份到 localStorage：裸链接进入沿用上次
    const hq = read('web/src/lib/hashQuery.js');
    must(hq.includes('PAGE_PREF') && hq.includes('localStorage.setItem'), 'hashQuery 没镜像筛选到 localStorage');
    must(/p\.has\(k\)/.test(hq), 'hash 有值时应当优先于存档');

    must(js.includes('vrc-pref:'), '构建产物缺偏好持久化');
    return '排序/tab/搜索/时间窗/类型多选都记忆；hash 显式值优先于存档；隐私模式降级不报错';
  });

  /* ───── 107 好友列表分组：世界/收藏/信任等级可切，组头带计数 ───── */
  await check(107, '好友列表按 世界/收藏/信任等级 分组，组头显示计数', async () => {
    const g = read('web/src/lib/group.js');
    for (const mode of ['world', 'favorite', 'trust']) must(g.includes(`${mode}:`), `GROUP_MODES 缺 ${mode}`);

    const page = read('web/src/pages/FriendListPage.jsx');
    must(page.includes("import { GROUP_MODES, groupFriends }"), 'FriendListPage 没引 group.js');
    must(page.includes('data-group={group}') && page.includes('groupFriends(rows, group)'), '好友列表没接分组渲染');
    must(page.includes('group-row') && page.includes('data-group-count={g.count}'), '组头缺计数标记');

    // 纯函数行为：三模式计数正确、离线/未收藏/未分级垫底
    const rows = [
      { user_id: 'a', favorite: true, trust_rank: 4, online: true, world_id: 'w1', world_name: '甲' },
      { user_id: 'b', favorite: false, trust_rank: 1, online: true, world_id: 'w1', world_name: '甲' },
      { user_id: 'c', favorite: false, trust_rank: null, online: false, location: 'offline' },
    ];
    const byWorld = groupFriends(rows, 'world');
    must(byWorld[0].key === 'w1' && byWorld[0].count === 2, '世界分组计数不对');
    must(byWorld.at(-1).key === 'offline', '离线组没垫底');
    const byFav = groupFriends(rows, 'favorite');
    must(byFav[0].label === '收藏' && byFav[0].count === 1 && byFav[1].count === 2, '收藏分组计数不对');
    const byTrust = groupFriends(rows, 'trust');
    must(byTrust.at(-1).key === 'unknown', '未分级没垫底');
    must(groupFriends(rows, 'none')[0].count === 3, '不分组时行数不对');

    must(js.includes('group-row') && js.includes('按信任等级'), '构建产物缺分组 UI');
    must(/tr\.group-row/.test(css) || /\.group-row/.test(css), 'CSS 缺 .group-row');
    return '三种分组可切；世界组用 world_name（缺失回落 world_id），离线/未收藏/未分级垫底；组头带「N 人」';
  });

  /* ───── 103 导出跟随筛选：CSV 行数 = 页面计数 ───── */
  await check(103, '当前筛选下的 CSV 行数与页面计数一致', async () => {
    const rows = [
      { display_name: '小红', meets: 2, world_name: '甲,乙', last_world: '甲' },
      { display_name: 'A"B', meets: 5, world_name: null, last_world: '丙' },
    ];
    const { text, rows: n } = toCsv([{ key: 'display_name', label: '名字' }, { key: 'meets', label: '次数' }], rows);
    must(n === rows.length, 'toCsv 返回行数和输入不一致');
    const lines = text.replace(/^\ufeff/, '').trim().split('\n');
    must(lines.length === rows.length + 1, 'CSV 行数不等于表头+数据行');
    must(csvCell('甲,乙') === '"甲,乙"' && csvCell('A"B') === '"A""B"', '逗号/引号没转义');
    must(csvCell(null) === '' && csvCell(undefined) === '', '空值没写成空单元格');
    must(text.startsWith('\ufeff'), '缺 UTF-8 BOM（Excel 中文会乱码）');

    // 四页都用「页面正在显示的那份数组」导出，不另外请求接口
    const wired = [
      ['FriendsPage', 'toCsv([', 'shown'],
      ['PlayersPage', 'toCsv([', 'rows'],
      ['WorldsPage', 'toCsv([', 'all'],
      ['FriendLogPage', 'toCsv([', 'all'],
    ];
    for (const [page, frag, arg] of wired) {
      const s = read(`web/src/pages/${page}.jsx`);
      must(s.includes(frag) && s.includes('downloadCsv('), `${page} 没接 CSV 导出`);
      must(s.includes(`], ${arg})`), `${page} 导出的不是页面这份数据`);
      must(s.includes('data-export='), `${page} 缺导出按钮标记`);
    }
    // 世界库/好友历史导出前把筛选结果翻到底，行数才等于顶部总数
    must(read('web/src/pages/WorldsPage.jsx').includes('page.has_more'), '世界库导出没翻到底');
    must(read('web/src/pages/FriendLogPage.jsx').includes('page.next_cursor'), '好友历史导出没翻到底');
    // 页面计数标记
    must(read('web/src/pages/FriendsPage.jsx').includes('data-count="filtered"'), '好友位置缺筛选计数');
    must(read('web/src/pages/FriendLogPage.jsx').includes('data-total={total}'), '好友历史缺总数');
    must(js.includes('data-export'), '构建产物缺导出按钮');
    return '四页导出都取页面同源行；逗号/引号/空值转义正确；世界库与好友历史翻到底再导，行数=顶部计数';
  });

  /* ───── 104 通知同类聚合：同类型 24h 内合并带计数 ───── */
  await check(104, '同类型 24h 内合并成一条带计数，可展开', async () => {
    const at = (minAgo) => new Date(Date.UTC(2026, 10, 18, 2, 0, 0) - minAgo * 60_000).toISOString();
    const rows = [
      { id: 'a', type: 'invite', created_at: at(0), seen: false },
      { id: 'b', type: 'invite', created_at: at(60), seen: true },
      { id: 'c', type: 'friend_request', created_at: at(90), seen: false },
      { id: 'd', type: 'invite', created_at: at(60 * 25), seen: true },
    ];
    const g = aggregateNotifications(rows);
    const invite = g.find((x) => x.type === 'invite' && x.id === 'a');
    must(invite && invite.count === 2 && invite.unseen === 1, '24h 内同类型没合并/未读数不对');
    must(invite.ids.join() === 'a,b' && invite.items.length === 2, '组内 ids/items 不全');
    must(g.find((x) => x.id === 'd').count === 1, '超过 24h 的没断开');
    must(g.find((x) => x.type === 'friend_request').count === 1, '不同类型被合并了');

    const idx = read('server/src/index.js');
    must(idx.includes('aggregateNotifications('), '/api/notifications 没接聚合');
    must(idx.includes("req.query.group !== '0'"), '缺 group=0 关闭开关');

    const page = read('web/src/pages/NotificationsPage.jsx');
    must(page.includes('data-agg={n.count}'), '通知卡没显示聚合计数');
    must(page.includes('data-agg-list'), '聚合卡不能展开看明细');
    must(page.includes('ids: n.ids'), '标已读没带走整组');
    must(js.includes('data-agg'), '构建产物缺聚合计数');
    return '同 type 24h 合并、断开/异类不合并；卡片带 ×N 可展开；标已读一次带走整组';
  });

  /* ───── 105 全局搜索拼音首字母：输入 xh 命中「小红」 ───── */
  await check(105, '搜索支持拼音首字母（xh → 小红）', async () => {
    must(matchText('小红', 'xh') && matchText('马伏宇', 'MFY'), 'matchText 没命中拼音首字母');
    must(matchText('Ame小红', 'amexh'), '中英混合名没命中');
    must(!matchText('小红', 'hong'), '只做首字母，不该命中全拼');
    must(matchText('小红', ''), '空查询应放行');

    // 前端两处搜索框都走 matchText（好友位置、右栏名单）
    for (const f of ['web/src/pages/FriendsPage.jsx', 'web/src/components/RosterPanel.jsx']) {
      must(read(f).includes('matchText('), `${f} 没接拼音搜索`);
    }
    // 服务端全局搜索同一套语义（好友 / 世界 / 玩家）
    // 后端只能 import server 自己的副本：镜像里没有 web/，跨目录 import 会让容器启动即崩
    const r2 = read('server/src/routes/round2.js');
    must(r2.includes("from '../lib/pinyin.js'"), '全局搜索没复用 pinyin.js（应取 server/src/lib/pinyin.js）');
    must(!r2.includes('web/src/lib/pinyin.js'), '全局搜索跨目录 import 前端源码，镜像里不存在');
    must((r2.match(/matchText\(/g) ?? []).length >= 3, '全局搜索没对好友/世界/玩家都做拼音匹配');
    must(js.includes('matchText') || js.includes('codePointAt'), '构建产物缺拼音搜索');
    return '输入 xh 命中「小红」；中英混合名 amexh 也命中；服务端 /api/search 同步支持';
  });

  /* ───── 108 快捷键面板：分组列出 10+ 条 ───── */
  await check(108, '`?` 面板分组列出全部快捷键（10+ 条）', async () => {
    must(SHORTCUT_GROUPS.length >= 3, '快捷键分组少于 3 组');
    const items = SHORTCUT_GROUPS.flatMap((g) => g.items);
    must(items.length >= 10, `快捷键条目只有 ${items.length} 条`);
    for (const g of SHORTCUT_GROUPS) {
      must(g.name && Array.isArray(g.items) && g.items.length > 0, '分组缺 name/items');
      for (const it of g.items) must(it.label && Array.isArray(it.keys) && it.keys.length > 0, `条目缺 label/keys：${it.label}`);
    }
    // 面板必须从同一份数据渲染，不能再手抄一遍
    const panel = read('web/src/components/ShortcutHelp.jsx');
    must(panel.includes('SHORTCUT_GROUPS.map'), '面板没从 SHORTCUT_GROUPS 渲染');
    must(panel.includes('data-shortcut-group'), '面板缺分组标记');
    must(!panel.includes('PAGE_ORDER.slice'), '面板还在手写数字键列表');
    must(js.includes('data-shortcut-group'), '构建产物缺分组快捷键面板');
    return `${SHORTCUT_GROUPS.length} 组 / ${items.length} 条，面板与数据同源`;
  });

  /* ───── 106 世界详情：API 带作者/容量/访问量/在线好友，抽屉展示 ───── */
  await check(106, '世界详情含 作者/容量/去过次数/在线好友 并展示', async () => {
    const r2 = read('server/src/routes/round2.js');
    for (const col of ['visits_total', 'favorites', 'popularity']) {
      must(r2.includes(col), `/api/world/:id 没取 world.${col}`);
    }
    for (const field of ['friends_online', 'friends_visited', 'friend_visits', 'friends_first_at', 'first_at']) {
      must(r2.includes(field), `/api/world/:id 缺字段 ${field}`);
    }
    const col = read('server/src/collector.js');
    for (const k of ['visits_total', 'favorites', 'popularity']) {
      must(col.includes(k), `collector.upsertWorld 没写 ${k}`);
    }
    const dw = read('web/src/components/WorldDrawer.jsx');
    for (const key of ['visits_total', 'online', 'visits', 'friend_visits', 'author', 'capacity']) {
      must(new RegExp(`data-world-stat=(\"${key}\"|\\{key\\})`).test(dw), `WorldDrawer 缺 ${key} 的 data-world-stat`);
    }
    must(dw.includes('作者') && dw.includes('容量'), 'WorldDrawer 没写作者/容量');
    must(js.includes('data-world-stat'), '构建产物缺世界详情标记');
    must(js.includes('世界访问'), '构建产物缺世界访问量');
    return 'API 返回 visits_total/favorites/popularity + friends_online[]/friend_visits/friends_visited；抽屉两行四格展示';
  });

  const ok = results.filter((r) => r.ok).length;
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.ok ? ` — ${r.detail}` : `\n       ${r.detail}`}`);
  const done = results.length >= TOTAL_ITEMS && ok === TOTAL_ITEMS;
  console.log(`\n${done ? 'PARITY10 OK' : 'PARITY10 PARTIAL'} ${ok}/${results.length}（目标 ${TOTAL_ITEMS} 项，剩 ${TOTAL_ITEMS - results.length} 项未做）`);
  exitCode = done ? 0 : 1;
} catch (e) {
  console.error(`PARITY10 ERROR ${e.stack || e.message}`);
}
process.exit(exitCode);
