import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { openDb } from '../src/db/index.js';
import { registerRound4Routes } from '../src/routes/round4.js';
import { filterWorlds } from '../src/lib/worldFilter.js';

const W = (id, name, { author = null, visits = 0, capacity = null, fav = false } = {}) =>
  ({ id, name, author_name: author, visits, capacity, fav });

const FIXTURE = [
  W('a', '猫咪咖啡馆', { author: '阿猫', visits: 5, capacity: 8, fav: true }),
  W('b', 'Neon Club', { author: 'Neo', visits: 2, capacity: 32, fav: false }),
  W('c', '小房间', { author: '阿猫', visits: 1, capacity: 4, fav: true }),
  W('d', '未知容量世界', { author: null, visits: 9, capacity: null, fav: false }),
  W('e', '大舞厅', { author: 'Dancer', visits: 12, capacity: 64, fav: false }),
];

test('114 收藏筛选只留 fav=true', () => {
  const r = filterWorlds(FIXTURE, { fav: true });
  assert.deepEqual(r.map((w) => w.id), ['a', 'c']);
  assert.deepEqual(filterWorlds(FIXTURE, { fav: false }).map((w) => w.id), ['a', 'b', 'c', 'd', 'e']);
});

test('114 去过次数按「≥N」筛，0 等于不限', () => {
  assert.deepEqual(filterWorlds(FIXTURE, { minVisits: 0 }).map((w) => w.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(filterWorlds(FIXTURE, { minVisits: 3 }).map((w) => w.id), ['a', 'd', 'e']);
  assert.deepEqual(filterWorlds(FIXTURE, { minVisits: 10 }).map((w) => w.id), ['e']);
});

test('114 容量分桶边界正确，容量未知不进具体桶', () => {
  assert.deepEqual(filterWorlds(FIXTURE, { capacity: 'small' }).map((w) => w.id), ['a', 'c'], '≤8 含 8/4');
  assert.deepEqual(filterWorlds(FIXTURE, { capacity: 'mid' }).map((w) => w.id), [], '9–16 没人');
  assert.deepEqual(filterWorlds(FIXTURE, { capacity: 'large' }).map((w) => w.id), ['b'], '17–32 含 32');
  assert.deepEqual(filterWorlds(FIXTURE, { capacity: 'huge' }).map((w) => w.id), ['e'], '33+ 含 64');
  assert.deepEqual(filterWorlds(FIXTURE, { capacity: 'any' }).map((w) => w.id), ['a', 'b', 'c', 'd', 'e']);
});

test('114 三个筛选项可组合，计数=组合后长度', () => {
  const r = filterWorlds(FIXTURE, { fav: true, minVisits: 3, capacity: 'small' });
  assert.deepEqual(r.map((w) => w.id), ['a']);
  assert.equal(r.length, 1);

  const none = filterWorlds(FIXTURE, { fav: true, minVisits: 10 });
  assert.equal(none.length, 0);
});

test('114 搜索与筛选叠加（中文名 + 作者）', () => {
  assert.deepEqual(filterWorlds(FIXTURE, { q: '阿猫', capacity: 'small' }).map((w) => w.id), ['a', 'c']);
  assert.deepEqual(filterWorlds(FIXTURE, { q: '阿猫', minVisits: 3 }).map((w) => w.id), ['a']);
});

/** 真路由 + 内存 SQLite：接口返回的 total 必须等于组合筛选后的条数 */
test('114 GET /api/worlds 组合筛选 + total/has_more 与筛选一致', async () => {
  const db = await openDb(':memory:');
  const T = (n) => db.tbl(n);
  const iso = (v) => (v instanceof Date ? v.toISOString() : v);

  const rows = [
    ['wrld_a', '猫咪咖啡馆', '阿猫', 8],
    ['wrld_b', 'Neon Club', 'Neo', 32],
    ['wrld_c', '小房间', '阿猫', 4],
    ['wrld_e', '大舞厅', 'Dancer', 64],
  ];
  for (const [id, name, author, cap] of rows) {
    await db.query(`insert into ${T('world')} (id, name, author_name, capacity) values (?,?,?,?)`,
      [id, name, author, cap]);
  }
  // 到访次数：a=5, b=2, c=1, e=12
  for (const [id, n] of [['wrld_a', 5], ['wrld_b', 2], ['wrld_c', 1], ['wrld_e', 12]]) {
    for (let i = 0; i < n; i++) {
      await db.query(
        `insert into ${T('self_event')} (kind, world_id, at) values ('location', ?, ?)`,
        [id, new Date(Date.UTC(2026, 10, 1, i)).toISOString()],
      );
    }
  }
  await db.query(`insert into ${T('favorite')} (id, kind, target_id) values ('f1','world','wrld_a')`);
  await db.query(`insert into ${T('favorite')} (id, kind, target_id) values ('f2','world','wrld_c')`);

  const app = Fastify({ logger: false });
  registerRound4Routes(app, { db, T, iso });

  const get = async (qs) => (await app.inject({ method: 'GET', url: `/api/worlds?${qs}` })).json();

  const all = await get('limit=50');
  assert.equal(all.total, 4);

  const fav = await get('fav=1&limit=50');
  assert.equal(fav.total, 2, '收藏两个世界');
  assert.deepEqual(fav.worlds.map((w) => w.id).sort(), ['wrld_a', 'wrld_c']);
  assert.ok(fav.worlds.every((w) => w.fav === true), '收藏行带 fav 标记');

  const small = await get('capacity=small&limit=50');
  assert.deepEqual(small.worlds.map((w) => w.id).sort(), ['wrld_a', 'wrld_c']);
  assert.equal(small.total, 2);

  const combo = await get('fav=1&min_visits=3&capacity=small&limit=50');
  assert.equal(combo.total, 1, '收藏 ∩ 去过≥3 ∩ 容量≤8 = 猫咪咖啡馆');
  assert.equal(combo.worlds[0].id, 'wrld_a');
  assert.deepEqual(combo.filters, { fav: true, min_visits: 3, capacity: 'small' });

  const paged = await get('capacity=small&limit=1&offset=0');
  assert.equal(paged.total, 2, 'total 是筛选后全量，不是本页条数');
  assert.equal(paged.worlds.length, 1);
  assert.equal(paged.has_more, true);

  await app.close();
  await db.close();
});
