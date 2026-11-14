#!/usr/bin/env node
/**
 * VRChat 日志代理：在装了 VRChat 的 PC 上跑，把 output_log 里的房间事件推给 NAS。
 *
 * 用法（Windows）：
 *   set VRC_INGEST_URL=http://192.168.31.254:8730/vrc
 *   set VRC_INGEST_TOKEN=<NAS 上 /opt/data/state/vrc-web/ingest.token 的内容>
 *   node agent.mjs
 *
 * 只读 %LOCALAPPDATA%Low\VRChat\VRChat\output_log_*.txt，不改游戏文件、不打 mod。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const URL_BASE = (process.env.VRC_INGEST_URL || 'http://192.168.31.254:8730/vrc').replace(/\/$/, '');
const TOKEN = process.env.VRC_INGEST_TOKEN || '';
const STATE = path.join(os.homedir(), '.vrc-agent-state.json');
const LOG_DIR = process.env.VRC_LOG_DIR
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Low', 'VRChat', 'VRChat');

if (!TOKEN) {
  console.error('缺少 VRC_INGEST_TOKEN 环境变量');
  process.exit(1);
}

let state = { file: null, offset: 0, world: null };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE, 'utf8')) }; } catch { /* 首次运行 */ }

const pending = [];

function newestLog() {
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
  if ((m = /\[Behaviour\] OnPlayerJoined\s+(.+?)(?:\s+\((usr_[0-9a-f-]+)\))?\s*$/.exec(line))) {
    return { kind: 'room_join', displayName: m[1].trim(), userId: m[2] ?? null, worldName: state.world, at };
  }
  if ((m = /\[Behaviour\] OnPlayerLeft\s+(.+?)(?:\s+\((usr_[0-9a-f-]+)\))?\s*$/.exec(line))) {
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

async function flush() {
  if (!pending.length) return;
  const batch = pending.splice(0, 100);
  try {
    const r = await fetch(`${URL_BASE}/ingest/log`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-token': TOKEN },
      body: JSON.stringify({ events: batch }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log(`[push] ${batch.length} 条 → ${r.status}`);
  } catch (e) {
    console.error('[push] 失败，放回队列', e.message);
    pending.unshift(...batch);
  }
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
  for (const line of buf.toString('utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const ev = parseLine(line, now);
    if (ev) pending.push(ev);
  }
  if (pending.length) flush();
  fs.writeFileSync(STATE, JSON.stringify(state));
}

console.log(`[agent] 监听 ${LOG_DIR}`);
setInterval(tick, 2000);
tick();
