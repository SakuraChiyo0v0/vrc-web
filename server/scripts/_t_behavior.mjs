
import { deriveBehavior, trustRankOf, worldIdOf } from '../src/lib/behavior.js';
const t = (h) => new Date(Date.UTC(2026, 10, 14, h, 0, 0)).toISOString();
const ev = [
  { kind: 'online', location: 'wrld_a:1~region(jp)', world_name: 'Alpha', at: t(1) },
  { kind: 'active', location: 'wrld_a:1~region(jp)', world_name: 'Alpha', at: t(2) },
  { kind: 'location', location: 'wrld_b:2~region(us)', world_name: 'Beta', at: t(3) },
  { kind: 'location', location: 'private', at: t(4) },
  { kind: 'location', location: 'wrld_b:3~region(us)', world_name: 'Beta', at: t(5) },
  { kind: 'offline', at: t(6) },
  { kind: 'online', location: 'wrld_a:9~region(jp)', world_name: 'Alpha', at: t(8) },
];
const r = deriveBehavior(ev);
console.log(JSON.stringify({ sessions: r.sessions, visits: r.visits, open: r.open }, null, 1));
console.log('trust', trustRankOf(['system_trust_trusted','admin_scripts_allowed']), trustRankOf([]), trustRankOf(undefined));
console.log('wid', worldIdOf('wrld_1234abcd-0000:123~region(us)'));
