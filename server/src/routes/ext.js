import { createStore } from '../lib/store.js';

/**
 * 对外只读集成 API：/api/ext/*，需 `x-api-token` 或 `Authorization: Bearer <token>`。
 * 令牌存在 api_token 表（server/scripts/token.mjs 增删）。只读，不暴露写操作。
 */
export function registerExtRoutes(app, { db, T, iso }) {
  const store = createStore({ db, T, iso });

  const pickToken = (req) => {
    const h = req.headers['x-api-token'];
    if (typeof h === 'string' && h.trim()) return h.trim();
    const auth = req.headers.authorization ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    return m ? m[1].trim() : '';
  };

  const auth = async (req, reply) => {
    const token = pickToken(req);
    if (!token) return reply.code(401).send({ ok: false, error: 'missing token' });
    const [row] = await db.query(`select token, name from ${T('api_token')} where token = ?`, [token]);
    if (!row) return reply.code(401).send({ ok: false, error: 'invalid token' });
    db.query(`update ${T('api_token')} set last_used_at = ? where token = ?`, [new Date().toISOString(), token])
      .catch(() => {});
    req.apiToken = row;
  };

  app.get('/api/ext/status', { preHandler: auth }, async () => {
    const [s] = await db.query(`select connected, last_msg_at, msg_count from ${T('collector_state')} where id = 1`);
    return {
      ok: true,
      token: req.apiToken,
      db: db.dialect,
      collector: s
        ? { connected: !!Number(s.connected), lastMsgAt: s.last_msg_at ? iso(s.last_msg_at) : null, msgCount: Number(s.msg_count ?? 0) }
        : { connected: false, lastMsgAt: null, msgCount: 0 },
    };
  });

  app.get('/api/ext/friends', { preHandler: auth }, async (req) => {
    const list = await store.friends({ onlineOnly: req.query.online === '1' });
    return { total: list.length, friends: list };
  });

  app.get('/api/ext/players', { preHandler: auth }, async (req) => {
    const minMeets = Math.max(1, Number(req.query.min_meets ?? 1) || 1);
    const list = await store.players({ minMeets });
    return { returned: list.length, min_meets: minMeets, players: list.slice(0, 200) };
  });

  app.get('/api/ext/insights', { preHandler: auth }, async (req) => {
    const days = Number(req.query.days ?? 90);
    return store.insights({ days, limit: Math.min(50, Math.max(1, Number(req.query.limit ?? 10) || 10)) });
  });
}
