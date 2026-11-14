import { createStore } from '../lib/store.js';

/** 洞察页：常一起玩 / 渐行渐远 / 最常遇到时段 */
export function registerInsightRoutes(app, { db, T, iso }) {
  const store = createStore({ db, T, iso });
  app.get('/api/insights', async (req) => {
    const days = Number(req.query.days ?? 90);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10) || 10));
    return store.insights({ days, limit });
  });
}
