import { q } from './db.js';
await q("delete from vrc.friend_event where user_id like 'usr_test_%'");
await q("delete from vrc.friend where user_id like 'usr_test_%'");
console.log('cleaned');
process.exit(0);
