/**
 * 46 采集断连告警：collector 超过阈值（默认 30 分钟）没有新消息就记一条 alert_event，
 * 恢复后把未解决的那条标 resolved_at。
 *
 * 为什么在 diagnostics 里判：采集器和 API 是同一个进程集合，任何一次读诊断都能顺带判活；
 * 不想再起一个定时任务。去重靠 fingerprint + 窗口，避免每个请求都插一条。
 *
 * alert_emit 接入：设了 VRC_ALERT_EMIT（shell 命令）才会外发，消息正文走 stdin。
 * 例：VRC_ALERT_EMIT='python3 /opt/data/scripts/alert_emit.py --level P1 vrc-collector-stale'
 * 没设就只落库，不影响任何请求。
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

export const FINGERPRINT = 'vrc-collector-stale:disconnected';

export function staleThreshold() {
  const n = Number(process.env.VRC_STALE_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function dedupeHours() {
  const n = Number(process.env.VRC_ALERT_DEDUPE_HOURS);
  return Number.isFinite(n) && n >= 0 ? n : 6;
}

function emit(message) {
  const cmd = process.env.VRC_ALERT_EMIT;
  if (!cmd) return false;
  try {
    const child = spawn('sh', ['-c', cmd], { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => {});
    child.stdin.end(message);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {{thresholdMinutes:number, idleMinutes:number|null, isStale:boolean,
 *            recorded:boolean, emitted:boolean, alerts:{count7d:number, lastAt:string|null}}}
 */
export async function checkCollectorStale({ db, T, iso }) {
  const threshold = staleThreshold();
  const [s] = await db.query(
    `select connected, last_msg_at from ${T('collector_state')} where id = 1`,
  ).catch(() => [null]);

  const lastAt = s?.last_msg_at ? iso(s.last_msg_at) : null;
  const idleMinutes = lastAt ? Math.max(0, Math.round((Date.now() - new Date(lastAt).getTime()) / 60000)) : null;
  // 没有基线（从没收到过消息）不算断连，否则新建库会一直报
  const isStale = idleMinutes !== null && idleMinutes > threshold;

  let recorded = false;
  let emitted = false;

  if (isStale) {
    const since = new Date(Date.now() - dedupeHours() * 3600_000).toISOString();
    const [recent] = await db.query(
      `select id from ${T('alert_event')} where fingerprint = ? and created_at >= ? limit 1`,
      [FINGERPRINT, since],
    ).catch(() => [null]);
    const [open] = await db.query(
      `select id from ${T('alert_event')} where fingerprint = ? and resolved_at is null limit 1`,
      [FINGERPRINT],
    ).catch(() => [null]);
    if (!recent && !open) {
      const msg = `VRC 采集器断连 ${idleMinutes} 分钟（阈值 ${threshold}）`;
      await db.query(
        `insert into ${T('alert_event')} (id, fingerprint, level, source, message, created_at)
         values (?,?,?,?,?,?)`,
        [crypto.randomUUID(), FINGERPRINT, 'P1', 'vrc-web', msg, new Date().toISOString()],
      ).catch(() => {});
      recorded = true;
      emitted = emit(msg);
    }
  } else if (idleMinutes !== null) {
    // 恢复：把未解决的标记掉（只留第一条的 resolved_at 语义，不刷屏）
    await db.query(
      `update ${T('alert_event')} set resolved_at = ? where fingerprint = ? and resolved_at is null`,
      [new Date().toISOString(), FINGERPRINT],
    ).catch(() => {});
  }

  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [c] = await db.query(
    `select count(*) as n, max(created_at) as last_at from ${T('alert_event')}
      where fingerprint = ? and created_at >= ?`,
    [FINGERPRINT, since7d],
  ).catch(() => [null]);

  return {
    thresholdMinutes: threshold,
    idleMinutes,
    isStale,
    recorded,
    emitted,
    alerts: {
      count7d: Number(c?.n ?? 0),
      lastAt: c?.last_at ? iso(c.last_at) : null,
    },
  };
}
