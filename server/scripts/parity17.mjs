/**
 * 第十七轮对齐检查（性能与韧性）。
 *   node server/scripts/parity17.mjs     # 退出码 0 = 全绿（先 cd web && npm run build）
 *
 * 171 核心接口 p95：8 个读接口 p95 <100ms（perf17 压测，20 次取样；搜索另算，friend-log 200ms 档）
 * 172 错误边界：16 个页面全在 ErrorBoundary 内（换页重置）+ 根边界兜住外壳，真实抛错可降级
 * 173 冷启动：spawn → /api/health 首次 200 <3s
 * 174 索引进 migrate：migrate 对空库/老库都补出 9 个查询索引，且可重复执行
 * 175 回归：parity14 仍 5/5
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../../', import.meta.url).pathname;
const SERVER = path.join(ROOT, 'server');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist/assets');
const asset = (ext) => {
  if (!fs.existsSync(distDir)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  const files = fs.readdirSync(distDir).filter((x) => x.endsWith(ext));
  if (!files.length) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return files.map((f) => fs.readFileSync(path.join(distDir, f), 'utf8')).join('\n');
};

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    let log = '';
    const p = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...(opts.env ?? {}) } });
    p.stdout.on('data', (d) => { log += d; });
    p.stderr.on('data', (d) => { log += d; });
    p.on('close', (code) => res({ code, log }));
  });
}
const tmpDb = (tag) => path.join(os.tmpdir(), `vrc-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.db`);
const rmDb = (f) => { for (const x of [f, `${f}-wal`, `${f}-shm`]) { try { fs.unlinkSync(x); } catch {} } };

/* perf17 只跑一次，171/173 各取自己那部分 */
let perf = await run(process.execPath, ['scripts/perf17.mjs'], { cwd: SERVER });
if (perf.code !== 0 && /api 未启动/.test(perf.log)) {
  perf = await run(process.execPath, ['scripts/perf17.mjs'], { cwd: SERVER });
}
const perfLines = perf.log.split('\n').filter((l) => l.startsWith('PERF17 '));
const perfRows = perfLines
  .map((l) => l.match(/^PERF17 (.+?) p95=(\d+)ms max=\d+ms \(<(\d+)\) (OK|FAIL)$/))
  .filter(Boolean)
  .map((m) => ({ name: m[1], p95: Number(m[2]), limit: Number(m[3]), ok: m[4] === 'OK' }));
const cold = perf.log.match(/^PERF17 冷启动 (\d+)ms/m);

let exitCode = 1;
try {
  /* ───── 171 核心接口 p95 ───── */
  await check(171, '核心接口 p95 <100ms（8 个读接口，20 次取样）', async () => {
    must(!/api 未启动/.test(perf.log), `临时服务没起来：${perf.log.split('\n').slice(-4).join(' | ')}`);
    must(perfRows.length >= 8, `perf17 只输出 ${perfRows.length} 个接口计时`);
    const core = ['health', 'status', 'friends', 'events', 'notifications', 'sessions', 'players', 'stats'];
    const got = new Set(perfRows.map((r) => r.name));
    for (const c of core) must(got.has(c), `缺核心接口 ${c} 的计时`);
    for (const r of perfRows) {
      must(r.ok, `${r.name} p95=${r.p95}ms 超 ${r.limit}ms`);
      if (core.includes(r.name)) must(r.p95 < 100, `${r.name} p95=${r.p95}ms ≥100ms`);
    }
    must(!/结果条数[^\n]*（空：/.test(perf.log), '有接口返回空结果集，计时不可信');
    must(perf.code === 0, `perf17 退出码 ${perf.code}：${perf.log.split('\n').filter(Boolean).slice(-3).join(' | ')}`);
    const show = perfRows.map((r) => `${r.name}=${r.p95}`).join(' ');
    return `8 核心接口全部 <100ms；${show}（含搜索/friend-log）`;
  });

  /* ───── 172 错误边界覆盖所有页面 ───── */
  await check(172, '16 个页面全在 ErrorBoundary 内 + 根边界兜外壳', async () => {
    const app = read('web/src/App.jsx');
    const block = app.match(/const PAGES = \{([\s\S]*?)\n\};/);
    must(block, 'App.jsx 找不到 PAGES 路由表');
    const routes = [...block[1].matchAll(/(\w+):\s*lazy\(\(\) => import\('\.\/pages\/(\w+)\.jsx'\)\)/g)]
      .map((m) => ({ key: m[1], file: `${m[2]}.jsx` }));
    const pageFiles = fs.readdirSync(path.join(ROOT, 'web/src/pages')).filter((f) => f.endsWith('.jsx')).sort();
    must(routes.length >= 16, `只有 ${routes.length} 个页面注册（应 ≥16）`);
    const routed = routes.map((r) => r.file).sort();
    must(JSON.stringify(routed) === JSON.stringify(pageFiles), `页面未全覆盖：注册 ${routed.length} / 目录 ${pageFiles.length}`);
    // 每个页面都渲染在同一个页面级边界内，key={page} 保证换页重置
    must(
      /<ErrorBoundary key=\{page\}>[\s\S]*<Suspense fallback=\{[^}]*\}[\s\S]*<Page onNavigate=\{setPage\} \/>[\s\S]*<\/Suspense>[\s\S]*<\/ErrorBoundary>/.test(app),
      '页面没有统一包在 <ErrorBoundary key={page}> 里',
    );
    // 外壳（侧栏/右栏/浮层）在页面边界之外，靠根边界兜底
    const main = read('web/src/main.jsx');
    must(/<ErrorBoundary>[\s\S]*<App \/>[\s\S]*<\/ErrorBoundary>/.test(main), 'main.jsx 没给 App 套根错误边界');
    // 边界本身：捕获 + 重置 + 重试卡
    const eb = read('web/src/components/ErrorBoundary.jsx');
    must(/static getDerivedStateFromError/.test(eb), '边界没有 getDerivedStateFromError');
    must(/reset = \(\) => this\.setState\(\{ error: null \}\)/.test(eb), '边界没有重试重置');
    must(/data-error-card="1"/.test(eb) && /这个页面出错了/.test(eb), '兜底卡缺标记/文案');
    // 真实行为：转译后实例化，抛错 → state.error，重试 → 清空
    const esbuild = await import(pathToFileURL(path.join(ROOT, 'web/node_modules/esbuild/lib/main.js')).href);
    const out = path.join(os.tmpdir(), `eb-${Date.now()}.mjs`);
    await esbuild.build({
      entryPoints: [path.join(ROOT, 'web/src/components/ErrorBoundary.jsx')],
      bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: out, logLevel: 'silent',
    });
    try {
      const mod = await import(`${pathToFileURL(out).href}?t=${Date.now()}`);
      const EB = mod.default;
      must(typeof EB.getDerivedStateFromError === 'function', '转译后边界类不可用');
      const state = EB.getDerivedStateFromError(new Error('boom'));
      must(state?.error instanceof Error && state.error.message === 'boom', '边界没接住渲染异常');
      const inst = new EB({ children: null });
      inst.setState = (patch) => Object.assign(inst.state, patch);
      inst.state = state;
      inst.reset();
      must(inst.state.error === null, '重试没有清掉错误状态');
    } finally { try { fs.unlinkSync(out); } catch {} }
    // 产物里也要有兜底卡（防止改了源码没构建）
    const js = asset('.js');
    must(js.includes('这个页面出错了') && js.includes('data-error-card'), '构建产物缺错误边界兜底卡');
    return `${routes.length} 个页面全在页面级边界内（key={page} 换页重置）+ 根边界；抛错/重试实测通过`;
  });

  /* ───── 173 冷启动 ───── */
  await check(173, '冷启动 <3s（spawn → /api/health 首次 200）', async () => {
    must(cold, 'perf17 没输出冷启动计时');
    const ms = Number(cold[1]);
    must(ms > 0 && ms < 3000, `冷启动 ${ms}ms ≥3000ms`);
    return `${ms}ms（同进程内还包含建表/索引 DDL 与搜索缓存预热）`;
  });

  /* ───── 174 索引进 migrate ───── */
  await check(174, 'migrate 给空库/老库补出全部查询索引，可重复执行', async () => {
    const want = [
      'friend_event_kind_at_idx', 'friend_change_at_idx', 'friend_status_at_idx',
      'game_event_kind_at_idx', 'game_event_user_at_idx',
      'friend_session_started_idx', 'friend_visit_started_idx',
      'notification_created_idx', 'notification_seen_created_idx',
    ];
    const indexNames = (file) => {
      const db = new DatabaseSync(file);
      try {
        return db.prepare("select name from sqlite_master where type='index' and name not like 'sqlite_%'").all().map((r) => r.name);
      } finally { db.close(); }
    };
    const migrate = (file) => run(process.execPath, ['src/migrate.js'], {
      cwd: SERVER, env: { VRC_DB_URL: `sqlite:${file}` },
    });

    const fresh = tmpDb('migrate17-fresh');
    try {
      const m1 = await migrate(fresh);
      must(m1.code === 0, `migrate 空库失败：${m1.log.split('\n').slice(-3).join(' | ')}`);
      must(/schema ready \(sqlite\)/.test(m1.log), 'migrate 没打印 schema ready');
      const names = indexNames(fresh);
      for (const w of want) must(names.includes(w), `空库缺索引 ${w}`);
      must(names.length >= 22, `空库索引只有 ${names.length} 个（应 ≥22）`);
      const m2 = await migrate(fresh);
      must(m2.code === 0, 'migrate 重复执行失败');
      must(indexNames(fresh).length === names.length, 'migrate 重复执行后索引数变化（不幂等）');
      const before = names.length;

      // 老库：模拟第十二轮之前的库（索引缺失）再跑 migrate
      const old = tmpDb('migrate17-old');
      try {
        must((await migrate(old)).code === 0, '老库基底建库失败');
        const drop = new DatabaseSync(old);
        for (const n of ['friend_event_kind_at_idx', 'game_event_user_at_idx', 'notification_created_idx']) {
          drop.exec(`drop index if exists ${n}`);
        }
        drop.close();
        must(!indexNames(old).includes('notification_created_idx'), '模拟老库没删掉索引');
        const m3 = await migrate(old);
        must(m3.code === 0, `migrate 老库失败：${m3.log.split('\n').slice(-3).join(' | ')}`);
        const after = indexNames(old);
        for (const n of ['friend_event_kind_at_idx', 'game_event_user_at_idx', 'notification_created_idx']) {
          must(after.includes(n), `老库跑完 migrate 仍缺 ${n}`);
        }
        // PG 同源 DDL：两端都声明了这批索引
        const schema = read('server/src/db/schema.js');
        for (const w of want) must(schema.split('vrc.').join('').includes(w), `schema.js 缺 ${w}`);
        return `空库 ${before} 个索引、重复执行不变；老库删 3 个后 migrate 全部补回；PG/SQLite 同名`;
      } finally { rmDb(old); }
    } finally { rmDb(fresh); }
  });

  /* ───── 175 parity14 回归 ───── */
  await check(175, 'parity14 仍全绿（5/5）', async () => {
    const p = await run('bash', ['scripts/parity14_check.sh']);
    must(p.code === 0, `parity14 未通过：${p.log.split('\n').filter(Boolean).slice(-4).join(' | ')}`);
    must(/PARITY14 OK 5\/5/.test(p.log), 'parity14 输出不是 5/5');
    return 'PARITY14 OK 5/5';
  });

  const okCount = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}${r.ok ? '' : `\n     ${r.detail}`}`);
  }
  console.log(`\nPARITY17 ${okCount === results.length ? 'OK' : 'PARTIAL'} ${okCount}/${results.length}`);
  exitCode = okCount === results.length ? 0 : 1;
} catch (e) {
  console.log(`PARITY17 FAIL ${e.stack || e.message}`);
}
process.exit(exitCode);
