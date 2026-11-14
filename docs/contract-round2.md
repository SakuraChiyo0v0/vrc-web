# vrc-web 并行开发契约（2026-11-14 第二轮）

三个子任务**目录互斥**，任何人不得越界改动别的目录。

## 全局规则

- 仓库：`/opt/data/apps/vrc-web`（已与 origin/main 同步，工作区干净）
- 只改自己负责的文件；需要别人改动时在报告里写「需要 A 提供 …」，不要自己动手
- 不要 `git commit` / `git push`（父级统一提交）
- SQL 必须走 `server/src/db/*` 的适配层，不能写死 `pg` 或 `sqlite`
- 完成后必须跑各自的验收命令，并把**真实输出**贴进报告

## A · server（负责人：子 agent A）

允许改：`server/src/index.js`、`server/src/collector.js`、`server/src/db/*`、`server/scripts/*`

交付：

1. `GET /api/health` →
   ```json
   {"ok":true,"db":{"kind":"postgres|sqlite"},"collector":{"connected":true,"lastMsgAt":"ISO","msgCount":123,"lastError":null}}
   ```
   数据来自 `collector_state` 表与 db 适配层，不得暴露连接串。
2. 事件留存：读 `VRC_EVENT_RETENTION_DAYS`（默认 30），每天清理一次
   `friend_event` / `self_event` / `game_event` 中 `at < now - N days` 的行；
   启动时跑一次，之后每 24h 一次；日志打印删除行数。
3. `server/scripts/smoke.mjs` 增加对 `/api/health` 的断言（现有断言不能删）。

验收：

```bash
cd server && node scripts/smoke.mjs           # 必须输出 SMOKE OK，且包含 health ok
node -e "process.env.VRC_EVENT_RETENTION_DAYS='1';require('./src/db')" >/dev/null && echo env-ok
```

## B · web（负责人：子 agent B）

允许改：`web/src/**`（pages / components / api.js / styles.css）

交付：

1. 「玩家」页加**共处时长排行**：按 `meets` 次数降序，显示头像/名字/次数/最近一次时间；数据取 `GET /api/players`
2. 「我的行程」页加时间线视图：每条会话显示世界名、进入时间、停留分钟；数据取 `GET /api/my-sessions`
3. 空态要有文案（无数据时不要空白页）；不新增后端接口

验收：

```bash
cd web && npm run build    # 必须成功，无新 warning 级别错误
grep -q 'meets' src/pages/*.jsx && echo players-ok
```

## C · agent（负责人：子 agent C）

允许改：`agent/**`

交付：

1. 跟随日志轮转：每 30 秒重新解析最新 `output_log_*.txt`，切换文件时从头读
2. 断线重连：POST 失败指数退避（1s/2s/4s…上限 60s），不丢缓冲
3. 去重：同一行内容 5 分钟内只报一次（按行哈希）
4. `--dry` 模式：解析并打印将上报的事件，不发请求
5. 读取 token 支持 `--token` / `VRC_INGEST_TOKEN` / 文件三选一

验收：

```bash
node agent/agent.mjs --dry --once --file <样例日志>   # 打印事件、退出码 0
node agent/agent.mjs --help                           # 列出上面 5 个能力
```
