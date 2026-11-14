import { q } from './db.js';
const e = await q('select kind, display_name, coalesce(world_name, location) w, at from vrc.friend_event order by at desc limit 5');
console.log('events', await q('select count(*)::int c from vrc.friend_event'));
console.log(e);
console.log('online', await q("select count(*)::int c from vrc.friend where location not in ('offline','private','traveling') and location is not null"));
process.exit(0);
