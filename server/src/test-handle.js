
process.env.VRC_NO_MAIN = '1';
const { handle } = await import('../src/collector.js');
const { q } = await import('../src/db.js');

const uid = 'usr_test_' + Date.now();

// 1. friend-online：user 内嵌完整资料
await handle('friend-online', { userId: uid, platform: 'standalonewindows',
  location: 'wrld_00cd4c48-b304-430a-95b3-5ab6290ce544:123~region(jp)',
  user: { id: uid, displayName: 'TestUser', status: 'active', statusDescription: 'hi' } });

// 2. friend-location：只有 userId + location
await handle('friend-location', { userId: uid, location: 'wrld_00cd4c48-b304-430a-95b3-5ab6290ce544:456~region(jp)',
  user: { id: uid, displayName: 'TestUser' } });

// 3. friend-offline：只有 userId
await handle('friend-offline', { userId: uid, user: { id: uid, displayName: 'TestUser' } });

const rows = await q("select kind, user_id, world_id from vrc.friend_event where user_id=$1 order by at", [uid]);
console.log('events:', rows);
const f = await q('select display_name, status from vrc.friend where user_id=$1', [uid]);
console.log('friend:', f);
process.exit(0);
