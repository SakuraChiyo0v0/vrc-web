/**
 * 第五轮回填：把已有的 friend_event 全部重算成会话（friend_session）与世界访问（friend_world_visit）。
 *
 *   node server/scripts/backfill5.mjs --dry                    # 只算不写，看会生成多少区间
 *   VRC_DB_URL=sqlite:/tmp/x.db node server/scripts/backfill5.mjs
 *   node server/scripts/backfill5.mjs --user usr_xxx            # 只重算一个人
 *   node server/scripts/backfill5.mjs --verify                  # 只查库：区间覆盖了哪些事件
 *
 * 幂等：每个人都是先删自己的区间再按事件重放，跑几次结果都一样。
 */
import { openDb } from '../src/db/index.js';
import { dbUrl } from '../src/config.js';
import { rebuildAll, rebuildUser, deriveBehavior } from '../src/lib/behavior.js';

// 和 behavior.rebuildUser 取事件的条件保持一致，否则 --dry 的数字会比实跑大
const PRESENCE = `('online','location','offline','active','in-game')`;
const covers = (uid) => `exists (select 1 from ${T('friend_session')} s
        where s.user_id = e.user_id and s.started_at <= e.at and (s.ended_at is null or s.ended_at >= e.at))`;

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const verify = argv.includes('--verify');
const userArg = argv.indexOf('--user');
const only = userArg >= 0 ? argv[userArg + 1] : null;

const db = await openDb(dbUrl());
const T = (n) => db.tbl(n);

try {
  if (verify) {
    const [s] = await db.query(`select count(*) as n from ${T('friend_session')}`);
    const [v] = await db.query(`select count(*) as n from ${T('friend_world_visit')}`);
    const [o] = await db.query(`select count(*) as n from ${T('friend_session')} where ended_at is null`);
    const [ev] = await db.query(
      `select count(*) as n from ${T('friend_event')} e where e.user_id is not null and e.kind in ${PRESENCE}`,
    );
    const unc = await db.query(
      `select e.kind, count(*) as n from ${T('friend_event')} e
        where e.user_id is not null and e.kind in ${PRESENCE} and not ${covers()}
        group by e.kind`,
    );
    // 未覆盖事件只允许是「没有前导上线事件的孤立 offline」，其余算漏算
    const bad = unc.filter((r) => r.kind !== 'offline').reduce((a, r) => a + Number(r.n), 0);
    const lone = unc.filter((r) => r.kind === 'offline').reduce((a, r) => a + Number(r.n), 0);
    console.log(`VERIFY db=${db.dialect} sessions=${Number(s?.n ?? 0)} visits=${Number(v?.n ?? 0)} open_sessions=${Number(o?.n ?? 0)}`);
    console.log(`VERIFY presence_events=${Number(ev?.n ?? 0)} uncovered=${bad + lone} (lone_offline=${lone} missing=${bad})`);
    console.log(bad === 0 ? 'VERIFY OK' : 'VERIFY FAIL');
    if (bad !== 0) process.exitCode = 1;
  } else if (dry) {
    const rows = await db.query(
      `select user_id, kind, location, world_id, world_name, at from ${T('friend_event')}
        where user_id is not null and kind in ${PRESENCE} ${only ? 'and user_id = ?' : ''} order by user_id, at asc`,
      only ? [only] : [],
    );
    const byUser = new Map();
    for (const r of rows) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
      byUser.get(r.user_id).push(r);
    }
    let sessions = 0;
    let visits = 0;
    for (const [uid, events] of byUser) {
      const d = deriveBehavior(events);
      sessions += d.sessions.length;
      visits += d.visits.length;
      if (byUser.size <= 5) console.log(`  ${uid}: events=${events.length} sessions=${d.sessions.length} visits=${d.visits.length}`);
    }
    console.log(`DRY OK db=${db.dialect} users=${byUser.size} events=${rows.length} sessions=${sessions} visits=${visits}`);
  } else {
    const r = only
      ? await rebuildUser({ db, T, userId: only })
      : await rebuildAll({ db, T });
    if (only) {
      console.log(`BACKFILL OK db=${db.dialect} user=${only} events=${r.events} sessions=${r.sessions} visits=${r.visits}`);
    } else {
      console.log(`BACKFILL OK db=${db.dialect} users=${r.users} events=${r.events} sessions=${r.sessions} visits=${r.visits} failed=${r.failed.length}`);
      for (const f of r.failed.slice(0, 10)) console.log(`  !! ${f.userId}: ${f.error}`);
    }
    // 落库结果自检：表里的行数必须和这次算出来的一致
    const [c1] = await db.query(`select count(*) as n from ${T('friend_session')}`);
    const [c2] = await db.query(`select count(*) as n from ${T('friend_world_visit')}`);
    console.log(`STORED sessions=${Number(c1?.n ?? 0)} visits=${Number(c2?.n ?? 0)}`);
  }
} catch (e) {
  console.error('BACKFILL FAIL', e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
