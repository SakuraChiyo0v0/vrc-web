/**
 * 一键三端截图：容器内起临时演示服务(8899) → 通过 PC 上的 headless Chrome(CDP) 出图 → 收工关服务。
 *
 *   ssh -N -R 18899:127.0.0.1:8899 -L 9222:127.0.0.1:9222 pc    # 双隧道（PC 侧看 18899，容器侧看 9222）
 *   node scripts/shoot-auto.mjs                                   # 产出 docs/screenshots/round7-*.png
 *
 * 为什么不用 nohup/&：演示库是临时 sqlite，起完忘关会残留端口和 DB 锁；这里子进程统一托管并按需回收。
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const PORT = process.env.DEMO_PORT ?? '8899';
const url = `http://127.0.0.1:${PORT}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const demo = spawn(process.execPath, ['server/scripts/demo.mjs', PORT], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let demoLog = '';
demo.stdout.on('data', (b) => { demoLog += b; });
demo.stderr.on('data', (b) => { demoLog += b; });

let up = false;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) { up = true; break; }
  } catch {}
  if (demo.exitCode !== null) break;
  await wait(250);
}
if (!up) {
  console.error('演示服务没起来：\n' + demoLog);
  demo.kill('SIGTERM');
  process.exit(1);
}
// 种子写库在 DEMO READY 之后才算完：等它打日志，再等一拍。
// 注意：负载高时演示服务起得慢（实测 >20s），等不到就出图会拍到「接口未就绪」的空页面，
// 那种截图看着像 bug 其实是假象 —— 等不到就报错退出，不要静默拍空图。
let ready = false;
for (let i = 0; i < 240 && !demoLog.includes('DEMO READY'); i++) await wait(500);
if (demoLog.includes('DEMO READY')) ready = true;
if (!ready) {
  console.error('演示服务 120s 内没打 DEMO READY，拒绝出图（否则全是空态截图）\n' + demoLog);
  demo.kill('SIGTERM');
  process.exit(1);
}
await wait(500);

const shoot = spawn(process.execPath, ['scripts/shoot.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    APP: process.env.APP ?? `http://127.0.0.1:18899/`,
    CDP: process.env.CDP ?? 'http://127.0.0.1:9222',
  },
});
const code = await new Promise((r) => shoot.on('exit', (c, s) => r(c ?? (s ? 1 : 0))));
demo.kill('SIGTERM');
await wait(300);
if (demo.exitCode === null) demo.kill('SIGKILL');
process.exit(code);
