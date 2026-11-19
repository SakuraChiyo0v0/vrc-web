import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createImgCache, DEFAULT_MAX_BYTES } from '../src/lib/imgCache.js';

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'vrc-imgcache-'));

/** 手写一对 .bin/.json，mtime 按顺序往后推，模拟「谁先写谁先删」 */
async function seed(dir, key, bytes, mtimeMs) {
  await fs.writeFile(path.join(dir, `${key}.bin`), Buffer.alloc(bytes, 1));
  await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify({ url: `https://x/${key}`, ct: 'image/png', bytes }));
  const t = new Date(mtimeMs);
  await fs.utimes(path.join(dir, `${key}.bin`), t, t);
}

test('116 默认上限就是 200MB', () => {
  assert.equal(DEFAULT_MAX_BYTES, 200 * 1024 * 1024);
});

test('116 未超上限不动缓存，stats 字节/条数正确', async () => {
  const dir = await tmpDir();
  const cache = createImgCache(dir, { maxBytes: 1000 });
  await seed(dir, 'a', 300, Date.now() - 3000);
  await seed(dir, 'b', 300, Date.now() - 2000);
  const r = await cache.enforce();
  assert.equal(r.removed, 0, '600 < 1000 不该删');
  const s = await cache.stats();
  assert.equal(s.files, 2);
  assert.equal(s.bytes, 600);
  assert.equal(s.maxBytes, 1000);
  await fs.rm(dir, { recursive: true, force: true });
});

test('116 超上限从最旧的删到上限以内（bin+json 一起删）', async () => {
  const dir = await tmpDir();
  const cache = createImgCache(dir, { maxBytes: 1000 });
  const now = Date.now();
  await seed(dir, 'old', 600, now - 5000);
  await seed(dir, 'mid', 600, now - 3000);
  await seed(dir, 'new', 600, now - 1000);
  // 3×600=1800 > 1000，先删 old 剩 1200，再删 mid 剩 600
  const r = await cache.enforce();
  assert.equal(r.removed, 2);
  assert.equal(r.freed, 1200);
  assert.equal(r.bytes, 600);

  const left = (await fs.readdir(dir)).sort();
  assert.deepEqual(left, ['new.bin', 'new.json'], '最新的一份留着，旧的两份连 meta 一起删');
  await fs.rm(dir, { recursive: true, force: true });
});

test('116 put 写入即触发清理，命中的 key 能读回', async () => {
  const dir = await tmpDir();
  const cache = createImgCache(dir, { maxBytes: 700 });
  const buf = Buffer.from('fake-png-bytes');
  await cache.put('k1', 'https://api.vrchat.cloud/1', 'image/png', buf);
  await fs.utimes(path.join(dir, 'k1.bin'), new Date(Date.now() - 10_000), new Date(Date.now() - 10_000));

  const big = Buffer.alloc(600, 2);
  await cache.put('k2', 'https://api.vrchat.cloud/2', 'image/png', big);
  // k1(15) + k2(600) = 615 < 700，不该删
  assert.equal((await cache.stats()).files, 2);

  await cache.put('k3', 'https://api.vrchat.cloud/3', 'image/png', big);
  // 1215 > 700：删最旧的 k1 → 1200 仍超 → 再删 k2 → 只剩 k3
  const s = await cache.stats();
  assert.equal(s.files, 1);
  assert.equal(s.bytes, 600);
  assert.equal(await cache.get('k1'), null, 'k1 应被清掉');
  const hit = await cache.get('k3');
  assert.ok(hit && hit.bytes === 600 && hit.ct === 'image/png', 'k3 还能读回');
  await fs.rm(dir, { recursive: true, force: true });
});
