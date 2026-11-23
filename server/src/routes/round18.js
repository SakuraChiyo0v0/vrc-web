/**
 * 第十八轮：好友抽屉「数据」tab 的图表（181 在线时长 / 活跃时段 / 常去世界）。
 *
 * 182 旅程按月折叠、每日柱可点都在前端做，这里只补一份「按天 + 按时段」的时长聚合，
 * 免得抽屉为了画 30 根柱自己拉 500 段会话再在浏览器里切日。
 *
 * 时间一律按 +08:00 切日；单段在线超过 8 小时按 480 分钟截断（和 heatmap 的护栏一致）。
 */

const TZ = 8 * 3600_000;
const HOUR = 3600_000;
const MAX_SESSION_MINUTES = 480;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const isoOf = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? null : String(v));

/** 本地 (+08) 日期 YYYY-MM-DD */
const localDate = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);

/** 本地当天 0 点对应的 UTC 毫秒 */
const localMidnight = (ms) => Math.floor((ms + TZ) / 86400_000) * 86400_000 - TZ;

export function registerRound18Routes(app, { db, T, iso }) {
  const at = (v) => (v === null || v === undefined ? null : isoOf(iso(v)));

  /**
   * 181 好友按天时长 + 24 小时分布：
   *   daily: 连续 days 天（含 0 分钟的日子），date / minutes / sessions
   *   hours: 24 个桶，在线分钟数按小时重叠分摊
   * 求和与 /sessions 同一窗口一致（同样的 8 小时截断）。
   */
  app.get('/api/friend/:id/daily', async (req) => {
    const id = String(req.params.id);
    const days = clamp(Number(req.query.days ?? 30) || 30, 1, 365);
    const now = Date.now();
    const startMs = localMidnight(now) - (days - 1) * 86400_000;
    const since = new Date(startMs).toISOString();

    const rows = await db.query(
      `select started_at, ended_at, minutes from ${T('friend_session')}
        where user_id = ? and started_at >= ? order by started_at`,
      [id, since],
    );

    const byDate = new Map();
    for (let i = 0; i < days; i++) {
      byDate.set(localDate(startMs + i * 86400_000), { date: localDate(startMs + i * 86400_000), minutes: 0, sessions: 0 });
    }
    const hours = new Array(24).fill(0);
    let total = 0;
    let peak = null;

    for (const r of rows) {
      const sIso = at(r.started_at);
      const sMs = Date.parse(sIso);
      if (!Number.isFinite(sMs)) continue;
      const eMsRaw = r.ended_at ? Date.parse(at(r.ended_at)) : now;
      let minutes = r.minutes === null || r.minutes === undefined
        ? (Number.isFinite(eMsRaw) ? (eMsRaw - sMs) / 60_000 : 0)
        : Number(r.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      minutes = Math.min(minutes, MAX_SESSION_MINUTES);

      const day = byDate.get(localDate(sMs));
      if (day) {
        day.minutes += minutes;
        day.sessions += 1;
      }
      total += minutes;

      // 活跃时段：把这段在线按小时切开，跨小时的部分均摊到对应钟点
      const endMs = sMs + minutes * 60_000;
      let cursor = sMs;
      for (let guard = 0; cursor < endMs && guard < 24; guard++) {
        const hourStart = Math.floor((cursor + TZ) / HOUR) * HOUR - TZ;
        const hourEnd = hourStart + HOUR;
        const slice = Math.min(endMs, hourEnd) - cursor;
        const h = new Date(cursor + TZ).getUTCHours();
        hours[h] += slice / 60_000;
        cursor = Math.min(endMs, hourEnd);
      }
    }

    const daily = [...byDate.values()].map((d) => ({ ...d, minutes: Math.round(d.minutes) }));
    const rounded = hours.map((m) => Math.round(m));
    const peakHour = rounded.reduce((best, m, h) => (m > rounded[best] ? h : best), 0);
    if (rounded[peakHour] > 0) peak = { hour: peakHour, minutes: rounded[peakHour] };

    return {
      user_id: id,
      tz: '+08:00',
      days,
      since: new Date(startMs).toISOString(),
      daily,
      hours: rounded,
      total_minutes: Math.round(total),
      active_days: daily.filter((d) => d.minutes > 0).length,
      peak,
    };
  });
}
