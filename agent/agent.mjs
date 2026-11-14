#!/usr/bin/env node
/**
 * VRChat 日志代理：在装了 VRChat 的 PC 上跑，把 output_log 里的房间事件推给 NAS。
 *
 * 用法（Windows）：
 *   set VRC_INGEST_URL=http://192.168.31.254:8730/vrc
 *   set VRC_INGEST_TOKEN=<NAS 上 /opt/data/state/vrc-web/ingest.token 的内容>
 *   node agent.mjs
 *
 * 能力：
 *   1. 日志轮转：每 30 秒重新解析最新 output_log_*.txt，切换文件时从头读
 *   2. POST 失败指数退避（1/2/4…最大 60s），缓冲不丢
 *   3. 去重：同一行内容 5 分钟内只报一次（行哈希）
 *   4. --dry 只打印事件不发请求；--once 跑一轮退出；--file <path> 指定日志
 *   5. token：--token / VRC_INGEST_TOKEN / --token-file <path>
 *   6. --from <dir> 补录：批量回填历史 output_log（时间取日志行首时间戳）
 *
 * 只读 %LOCALAPPDATA%Low\VRChat\VRChat\output_log_*.txt，不改游戏文件、不打 mod。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const URL_BASE = (process.env.VRC_INGEST_URL || 'http://192.168.31.254:8730/vrc').replace(/\/$/, '');
const STATE = path.join(os.homedir(), '.vrc-agent-state.json');
// VRChat 的日志在 AppData\LocalLow（不是 AppData\Local\Low）
const LOG_DIR = process.env.VRC_LOG_DIR
  || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'LocalLow', 'VRChat', 'VRChat');

const TICK_MS = 30_000;          // 轮转扫描间隔
const DEDUP_MS = 5 * 60_000;     // 同一行内容 5 分钟内只报一次
const BACKOFF_MAX_MS = 60_000;   // 退避上限

// ---- CLI ----
function usage() {
  console.log(`VRChat 日志代理 (agent.mjs)

用法：
  node agent.mjs [选项]

选项：
  --dry               只解析并打印将上报的事件，不发任何请求
  --once              解析一轮就退出（可与其他选项组合）
  --file <path>       指定日志文件路径（默认自动找最新 output_log_*.txt）
  --token <token>     上报 token（三选一：--token / --token-file / VRC_INGEST_TOKEN）
  --token-file <path> 从文件读取 token（内容去空白）
  --from <dir>        补录：批量回填目录下所有 output_log_*.txt（配合 --dry 只统计）
  --help              显示本帮助

能力：
  1. 跟随日志轮转：每 30 秒重新解析最新 output_log_*.txt，切换文件时从头读
  2. POST 失败指数退避：1s/2s/4s…上限 60s，事件缓冲不丢，恢复后重发
  3. 去重：同一行内容 5 分钟内只报一次（按 sha256 行哈希）
  4. --dry / --once / --file 可组合使用
  5. token 三选一：--token、VRC_INGEST_TOKEN 环境变量、--token-file 文件
`);
}

const args = process.argv.slice(2);
let OPTS = { dry: false, once: false, file: null, token: null, tokenFile: null, from: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--help' || a === '-h') { usage(); process.exit(0); }
  else if (a === '--dry') OPTS.dry = true;
  else if (a === '--once') OPTS.once = true;
  else if (a === '--file') OPTS.file = args[++i];
  else if (a === '--token') OPTS.token = args[++i];
  else if (a === '--token-file') OPTS.tokenFile = args[++i];
  else if (a === '--from') OPTS.from = args[++i];
  else { console.error(`未知参数: ${a}（--help 查看用法）`); process.exit(1); }
}

// ---- 单实例：常驻模式只允许一个进程，否则同一行会被重复上报 ----
if (!OPTS.once && !OPTS.dry && !OPTS.from) {
  const lockFile = path.join(os.homedir(), '.vrc-agent.lock');
  try {
    const old = parseInt(fs.readFileSync(lockFile, 'utf8'), 10);
    if (old && old !== process.pid) {
      try { process.kill(old, 0); console.error(`已有 agent 在跑 (pid ${old})，退出`); process.exit(0); } catch { /* 陈旧锁 */ }
    }
  } catch { /* 无锁 */ }
  fs.writeFileSync(lockFile, String(process.pid));
  const release = () => { try { if (fs.readFileSync(lockFile, 'utf8').trim() === String(process.pid)) fs.unlinkSync(lockFile); } catch {} };
  process.on('exit', release);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

// ---- token：--token / --token-file / VRC_INGEST_TOKEN 三选一 ----
let TOKEN = OPTS.token ?? process.env.VRC_INGEST_TOKEN ?? '';
if (!TOKEN && OPTS.tokenFile) {
  try { TOKEN = fs.readFileSync(OPTS.tokenFile, 'utf8').trim(); }
  catch (e) { console.error(`读取 token 文件失败: ${e.message}`); process.exit(1); }
}
if (!TOKEN && !OPTS.dry) {
  console.error('缺少 token：用 --token、--token-file 或 VRC_INGEST_TOKEN 提供');
  process.exit(1);
}

let state = { file: null, offset: 0, world: null };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch { /* 首次运行 */ }

const pending = [];
const seen = new Map();   // lineHash -> lastReportedAt(ms)
let backoffMs = 0;        // 当前退避，0 = 可立即发
let nextSendAt = 0;

function lineHash(line) {
  return crypto.createHash('sha256').update(line).digest('hex');
}

/** 行去重：同一内容 5 分钟内只报一次 */
function isDuplicate(line) {
  const h = lineHash(line);
  const now = Date.now();
  const last = seen.get(h);
  if (last != null && now - last < DEDUP_MS) return true;
  seen.set(h, now);
  for (const [k, t] of seen) if (now - t >= DEDUP_MS) seen.delete(k);
  return false;
}

function newestLog() {
  if (OPTS.file) {
    const p = path.resolve(OPTS.file);
    const st = fs.statSync(p);
    return { path: p, name: path.basename(p), mtimeMs: st.mtimeMs };
  }
  let best = null;
  for (const name of fs.readdirSync(LOG_DIR)) {
    if (!name.startsWith('output_log_') || !name.endsWith('.txt')) continue;
    const p = path.join(LOG_DIR, name);
    const st = fs.statSync(p);
    if (!best || st.mtimeMs > best.mtimeMs) best = { path: p, name, mtimeMs: st.mtimeMs };
  }
  return best;
}

/** 日志行 → 事件（只认几种稳定的标记） */
function parseLine(line, ts) {
  const at = ts;
  let m;
  if ((m = /\[Behaviour\] OnPlayerJoined\s+(.+?)(?:\s+\((usr_[0-9a-zA-Z_-]+)\))?\s*$/.exec(line))) {
    return { kind: 'room_join', displayName: m[1].trim(), userId: m[2] ?? null, worldName: state.world, at };
  }
  if ((m = /\[Behaviour\] OnPlayerLeft\s+(.+?)(?:\s+\((usr_[0-9a-zA-Z_-]+)\))?\s*$/.exec(line))) {
    return { kind: 'room_leave', displayName: m[1].trim(), userId: m[2] ?? null, worldName: state.world, at };
  }
  if ((m = /\[Behaviour\] Entering Room:\s*(.+)$/.exec(line))) {
    state.world = m[1].trim();
    return { kind: 'room_enter', worldName: state.world, at };
  }
  if ((m = /\[Behaviour\] OnVideoPlay\s+(.+)$/.exec(line))) {
    return { kind: 'video_play', detail: { url: m[1].trim() }, worldName: state.world, at };
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function flush() {
  while (pending.length) {
    if (Date.now() < nextSendAt) return;   // 退避中，等待下一轮；缓冲保留
    const batch = pending.splice(0, 100);
    try {
      const r = await fetch(`${URL_BASE}/ingest/log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ingest-token': TOKEN },
        body: JSON.stringify({ events: batch }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      console.log(`[push] ${batch.length} 条 → ${r.status}`);
      backoffMs = 0;
    } catch (e) {
      console.error(`[push] 失败，${backoffMs || 1000}ms 后重试（缓冲 ${batch.length + pending.length} 条不丢）: ${e.message}`);
      pending.unshift(...batch);
      backoffMs = Math.min(backoffMs ? backoffMs * 2 : 1000, BACKOFF_MAX_MS);
      nextSendAt = Date.now() + backoffMs;
      return;
    }
  }
}

/** 日志行首时间（VRChat 写本地时间）：2026.11.01 10:00:01 → ISO */
function tsOfLine(line, fallback) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(line);
  if (!m) return fallback;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}

/** 补录：按文件名顺序回放目录里的 output_log_*.txt，时间取行首时间戳 */
async function backfill(dir) {
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => /output_log_.*\.txt$/i.test(n)).sort();
  } catch (e) {
    console.error(`[from] 读目录失败：${e.message}`);
    process.exit(1);
  }
  if (!names.length) {
    console.error(`[from] ${dir} 里没有 output_log_*.txt`);
    process.exit(1);
  }

  const events = [];
  for (const name of names) {
    const full = path.join(dir, name);
    state.world = null;                       // 每个文件是一局游戏，世界从头记
    const fallback = new Date(fs.statSync(full).mtimeMs).toISOString();
    const text = fs.readFileSync(full, 'utf8');
    let n = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const ev = parseLine(line, tsOfLine(line, fallback));
      if (!ev) continue;
      events.push({ ...ev, source: name });
      n++;
    }
    console.log(`[from] ${name} → ${n} 条`);
  }

  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  console.log(`backfill files=${names.length} events=${events.length}`);

  if (OPTS.dry) {
    for (const ev of events.slice(0, 20)) console.log(`[dry] ${JSON.stringify(ev)}`);
    if (events.length > 20) console.log(`[dry] … 其余 ${events.length - 20} 条未打印`);
    return;
  }

  pending.push(...events);
  while (pending.length) {
    await flush();
    if (pending.length) await sleep(backoffMs || 1000);
  }
  console.log(`[from] 已上报 ${events.length} 条`);
}

function tick() {
  let log;
  try { log = newestLog(); } catch (e) { return; }
  if (!log) return;

  if (state.file !== log.path) {
    // 换日志文件：从文件头开始读（新一局游戏）
    state.file = log.path;
    state.offset = 0;
  }

  const st = fs.statSync(log.path);
  if (st.size < state.offset) state.offset = 0;   // 文件被截断
  if (st.size === state.offset) return;

  const fd = fs.openSync(log.path, 'r');
  const buf = Buffer.alloc(st.size - state.offset);
  fs.readSync(fd, buf, 0, buf.length, state.offset);
  fs.closeSync(fd);
  state.offset = st.size;

  const now = new Date().toISOString();
  let printed = 0;
  for (const line of buf.toString('utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const ev = parseLine(line, now);
    if (!ev) continue;
    if (isDuplicate(line)) continue;
    pending.push(ev);
    printed++;
  }
  if (printed) console.log(`[scan] ${log.name} 新增事件 ${printed} 条`);
  if (OPTS.dry) {
    for (const ev of pending.splice(0)) console.log(`[dry] ${JSON.stringify(ev)}`);
  } else {
    flush();
  }
  if (!OPTS.dry) fs.writeFileSync(STATE, JSON.stringify(state));
}

if (OPTS.dry) {
  console.log('[agent] dry 模式：只打印事件，不发请求，不写状态');
} else {
  console.log(`[agent] 监听 ${LOG_DIR}`);
}

if (OPTS.from) {
  await backfill(OPTS.from);
  process.exit(0);
} else {
  tick();
  if (!OPTS.once) setInterval(tick, TICK_MS);
}
