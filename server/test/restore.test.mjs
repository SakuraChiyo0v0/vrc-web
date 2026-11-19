import assert from 'node:assert/strict';
import test from 'node:test';
import { openDb } from '../src/db/index.js';
import { restoreBackup, restoreFullBackup, normalizeBackup, normalizeFullBackup } from '../src/lib/restore.js';

/** 内存 SQLite，跑真 SQL（表由 openDb 的 DDL 建，和线上同结构） */
async function fresh() {
  const db = await openDb(':memory:');
  return { db, T: (n) => db.tbl(n) };
}

const backup = {
  friends: [{ user_id: 'usr_a', display_name: '甲' }],
  worlds: [{ id: 'wrld_1', name: '世界一' }],
  events: [{ id: 'e1', user_id: 'usr_a', kind: 'online', at: '2026-11-18T00:00:00.000Z' }],
  notes: [
    { user_id: 'usr_a', note: '只在周末上线', updated_at: '2026-11-18T01:00:00.000Z' },
    { user_id: 'usr_b', note: '  ', updated_at: '2026-11-18T01:00:00.000Z' },
  ],
  tags: [
    { user_id: 'usr_a', tag: '摄影' },
    { user_id: 'usr_a', tag: '摄影' },
    { user_id: 'usr_d', tag: '舞' },
  ],
  favorites: [
    { id: 'fav_1', kind: 'world', target_id: 'wrld_1', sort_order: 2 },
    { id: 'fav_1', kind: 'world', target_id: 'wrld_1', sort_order: 2 },
  ],
};

test('导入备注/标签/收藏，实写条数正确、坏行被过滤', async () => {
  const { db, T } = await fresh();
  const r = await restoreBackup(db, T, backup);
  assert.equal(r.notes, 1, '空备注应被过滤');
  assert.equal(r.tags, 3);
  assert.equal(r.favorites, 2);

  const notes = await db.query(`select * from ${T('friend_note')}`);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].note, '只在周末上线');
  assert.equal(notes[0].updated_at, '2026-11-18T01:00:00.000Z');

  const tags = await db.query(`select tag from ${T('friend_tag')} order by tag`);
  assert.deepEqual(tags.map((t) => t.tag), ['摄影', '舞'], '重复标签只落一行');

  const favs = await db.query(`select id, kind, target_id, sort_order from ${T('favorite')}`);
  assert.equal(favs.length, 1);
  assert.equal(favs[0].sort_order, 2);
  await db.close();
});

test('不碰事件流：导入前后 friend_event 行数不变', async () => {
  const { db, T } = await fresh();
  await db.query(
    `insert into ${T('friend_event')} (user_id, display_name, kind, at) values (?,?,?,?)`,
    ['usr_x', '旧行人', 'online', '2026-11-18T00:00:00.000Z'],
  );
  await restoreBackup(db, T, backup);
  const rows = await db.query(`select user_id, display_name from ${T('friend_event')}`);
  assert.deepEqual(rows.map((r) => r.display_name), ['旧行人'], '导入不应写入备份里的 events');
  await db.close();
});

test('重复导入幂等：备注覆盖、标签收藏不重复长行', async () => {
  const { db, T } = await fresh();
  await restoreBackup(db, T, backup);
  await restoreBackup(db, T, {
    ...backup,
    notes: [{ user_id: 'usr_a', note: '改过的备注' }],
  });
  const notes = await db.query(`select note from ${T('friend_note')}`);
  assert.deepEqual(notes.map((n) => n.note), ['改过的备注']);
  assert.equal((await db.query(`select * from ${T('friend_tag')}`)).length, 2);
  assert.equal((await db.query(`select * from ${T('favorite')}`)).length, 1);
  await db.close();
});

test('坏输入抛错：非对象 / 没有可导入的键', async () => {
  assert.throws(() => normalizeBackup([]), /不是 JSON 对象/);
  assert.throws(() => normalizeBackup({ friends: [], worlds: [] }), /没有备注\/标签\/收藏/);
  await assert.rejects(() => restoreBackup(null, (n) => n, { friends: [] }), /没有备注/);
});

test('全量导入：空库恢复好友/世界/动态/备注，第二次幂等', async () => {
  const { db, T } = await fresh();
  const r = await restoreFullBackup(db, T, backup);
  assert.equal(r.full, true);
  assert.deepEqual(r.friends, { inserted: 1, skipped: 0 });
  assert.deepEqual(r.worlds, { inserted: 1, skipped: 0 });
  assert.deepEqual(r.events, { inserted: 1, skipped: 0 });
  assert.equal(r.notes, 1);

  const f = await db.query(`select display_name from ${T('friend')}`);
  assert.equal(f.length, 1);
  const w = await db.query(`select name from ${T('world')}`);
  assert.equal(w.length, 1);
  const ev = await db.query(`select kind, at from ${T('friend_event')}`);
  assert.equal(ev.length, 1);

  const again = await restoreFullBackup(db, T, backup);
  assert.deepEqual(again.friends, { inserted: 0, skipped: 1 }, '已在库里的好友不重复插');
  assert.deepEqual(again.events, { inserted: 0, skipped: 1 }, '同一事件不重复插');
  assert.equal((await db.query(`select * from ${T('friend_event')}`)).length, 1);
  await db.close();
});

test('全量导入只补缺，不覆盖线上已有好友资料', async () => {
  const { db, T } = await fresh();
  await db.query(
    `insert into ${T('friend')} (user_id, display_name, updated_at) values (?,?,?)`,
    ['usr_a', '线上新名字', '2026-11-19T00:00:00.000Z'],
  );
  const r = await restoreFullBackup(db, T, backup);
  assert.deepEqual(r.friends, { inserted: 0, skipped: 1 });
  const [row] = await db.query(`select display_name from ${T('friend')} where user_id = ?`, ['usr_a']);
  assert.equal(row.display_name, '线上新名字');
  await db.close();
});

test('全量模式接受只有事件的备份；默认模式仍然拒绝', async () => {
  assert.throws(() => normalizeBackup({ events: [{ kind: 'online', at: '2026-11-18T00:00:00.000Z' }] }), /没有备注/);
  const { db, T } = await fresh();
  const r = await restoreFullBackup(db, T, { events: [{ kind: 'online', at: '2026-11-18T00:00:00.000Z' }] });
  assert.equal(r.events.inserted, 1);
  assert.throws(() => normalizeFullBackup({ friends: [{}] }), /没有可导入/);
  await db.close();
});
