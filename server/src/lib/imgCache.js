/**
 * 116 图片缓存：落盘 + 容量上限（默认 200MB）。
 *
 * 每次写入后按 mtime 从旧到新删，直到总量回到上限以内；上限之内的缓存不主动清。
 * 键不动（sha256 的 .bin/.json 一对），删的时候两份一起删，避免留下指向空文件的 meta。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;

const mb = (n) => Math.round((n / 1024 / 1024) * 10) / 10;

export function createImgCache(dir, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const binPath = (k) => path.join(dir, `${k}.bin`);
  const metaPath = (k) => path.join(dir, `${k}.json`);

  async function get(key) {
    try {
      const metaJson = JSON.parse(await fsp.readFile(metaPath(key), 'utf8'));
      const buf = await fsp.readFile(binPath(key));
      return { buf, ...metaJson };
    } catch {
      return null;
    }
  }

  /** 所有 .bin 的 (路径, mtimeMs, 大小)，按最旧在前 */
  async function entries() {
    let names = [];
    try { names = await fsp.readdir(dir); } catch { return []; }
    const out = [];
    for (const name of names) {
      if (!name.endsWith('.bin')) continue;
      const p = path.join(dir, name);
      try {
        const st = await fsp.stat(p);
        out.push({ key: name.slice(0, -4), path: p, mtimeMs: st.mtimeMs, bytes: st.size });
      } catch { /* 并发被删，跳过 */ }
    }
    return out.sort((a, b) => a.mtimeMs - b.mtimeMs);
  }

  /** 超上限就从最旧的删；返回删掉的条数与释放字节 */
  async function enforce() {
    let list = await entries();
    let total = list.reduce((s, e) => s + e.bytes, 0);
    let removed = 0;
    let freed = 0;
    for (const e of list) {
      if (total <= maxBytes) break;
      try {
        await fsp.unlink(e.path);
        await fsp.unlink(metaPath(e.key)).catch(() => {});
        total -= e.bytes;
        freed += e.bytes;
        removed += 1;
      } catch { /* 已被删，不计 */ }
    }
    return { removed, freed, bytes: total };
  }

  async function put(key, url, ct, buf) {
    const tmp = `${binPath(key)}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, binPath(key));
    await fsp.writeFile(metaPath(key), JSON.stringify({ url, ct, at: new Date().toISOString(), bytes: buf.length }));
    return enforce();
  }

  async function stats() {
    const list = await entries();
    const bytes = list.reduce((s, e) => s + e.bytes, 0);
    return {
      dir,
      files: list.length,
      bytes,
      human: `${mb(bytes)} MB`,
      maxBytes,
      maxHuman: `${Math.round(maxBytes / 1024 / 1024)} MB`,
      oldestAt: list.length ? new Date(list[0].mtimeMs).toISOString() : null,
    };
  }

  return { dir, maxBytes, get, put, stats, enforce, entries };
}
